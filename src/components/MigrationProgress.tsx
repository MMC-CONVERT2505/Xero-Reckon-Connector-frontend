import { useState, useEffect, type ReactNode } from "react";
import {
  Loader2,
  AlertCircle,
  Check,
  Loader2 as InProgressIcon,
  ArrowRight,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { api, COMPARATIVE_REPORT_YEARS, MigrationPhase, MigrationRecordData, MigrationStatus } from "@/lib/api";
import RequestHelpDialog from "./RequestHelpDialog";

interface MigrationRecord {
  id: string;
  name: string;
  count: number;
  status: "pending" | "in-progress" | "completed" | "error";
  progress: number;
  migrated: number;
  errors: number;
}

interface MigrationProgressProps {
  onComplete: () => void;
  fileId?: number | null;
  xeroToolId?: number | null;
  reckonToolId?: number | null;
}

const SOURCE_NAME = "Xero";
const TARGET_NAME = "Reckon";

// Maps the function id returned by /jobs/:id/status to the Mongo collection
// name expected by /jobs/:id/records/:table_name (mirrors the backend's
// TABLE_CONFIG_XERO in utils/xero_tables_config.py).
const RECORD_ID_TO_TABLE: Record<string, string> = {
  "Existing Chart of account": "existing_coa_reckon",
  accounts: "xero_coa",
  "Archieved Chart of account": "xero_archived_coa",
  customers: "xero_customer",
  "Archieved Customer": "xero_archived_customer",
  suppliers: "xero_supplier",
  "Archieved Supplier": "xero_archived_supplier",
  Job: "xero_job",
  Item: "xero_items",
  "Open Spend Overpayment": "xero_open_spend_overpayment",
  "Open Receive Overpayment": "xero_open_receive_overpayment",
  "Open AR": "xero_AR_openinvoice",
  "Open AP": "xero_AP_openbill",
  "Open Trial balance": "xero_trial_balance",
  Invoice: "xero_invoice",
  "Invoice creditnote": "xero_creditnote",
  Bill: "xero_bill",
  "Bill Vendorcredit": "xero_vendorcredit",
  "Spend Money": "xero_spend_money",
  "Receive Money": "xero_receive_money",
  Journal: "xero_manual_journal",
  Payrun: "xero_payrun",
  "Bank Transfer": "xero_bank_transfer",
  "Invoice Payment": "xero_invoice_payment",
  "Bill Payment": "xero_bill_payment",
};

const RECORD_EXCLUDED_FIELDS = ["_id", "job_id", "task_id", "is_pushed", "error", "table_name", "payload"];

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" });
  const year = date.getFullYear();
  return `${day} - ${month} - ${year}`;
};

const getStoredJobId = (): number | null => {
  const stored = localStorage.getItem("jobId");
  const parsed = stored ? Number(stored) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

// File name / dates are stored per job id (migrationFileName_<jobId> etc.) so that
// visiting/refreshing one job's progress page (e.g. /migration-progress/:jobId) never
// shows another job's data after the global "jobId" pointer has moved on to a newer
// migration. Jobs created before this change only have the old global keys, which are
// only trustworthy for whichever job is still the currently "active" one.
const readStoredFileName = (jobId: number): string | null => {
  const perJob = localStorage.getItem(`migrationFileName_${jobId}`);
  if (perJob) return perJob;

  if (localStorage.getItem("jobId") === String(jobId)) {
    try {
      const stored = localStorage.getItem("customerInfo");
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed?.companyName) return parsed.companyName as string;
    } catch {
      // ignore malformed storage
    }
  }
  return null;
};

const readStoredDates = (jobId: number): { start: string | null; end: string | null } => {
  const isActiveJob = localStorage.getItem("jobId") === String(jobId);
  return {
    start:
      localStorage.getItem(`migrationStartDate_${jobId}`) ??
      (isActiveJob ? localStorage.getItem("migrationStartDate") : null),
    end:
      localStorage.getItem(`migrationEndDate_${jobId}`) ??
      (isActiveJob ? localStorage.getItem("migrationEndDate") : null),
  };
};

const statusStyles: Record<
  MigrationRecord["status"],
  { label: string; badgeClass: string; icon: JSX.Element; progressLabel: string; barClass: string }
> = {
  pending: {
    label: "Pending",
    badgeClass: "bg-slate-100 text-slate-500",
    icon: <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />,
    progressLabel: "Pending",
    barClass: "bg-slate-300",
  },
  "in-progress": {
    label: "In Progress",
    badgeClass: "bg-blue-50 text-blue-600",
    icon: <InProgressIcon className="h-3 w-3 animate-spin" />,
    progressLabel: "In progress",
    barClass: "bg-gradient-to-r from-[#1f6aa5] to-sky-500",
  },
  completed: {
    label: "Completed",
    badgeClass: "bg-emerald-50 text-emerald-600",
    icon: <Check className="h-3 w-3" strokeWidth={3} />,
    progressLabel: "Complete",
    barClass: "bg-gradient-to-r from-[#1f6aa5] to-sky-500",
  },
  error: {
    label: "Under review",
    badgeClass: "bg-red-50 text-red-600",
    icon: <AlertCircle className="h-3 w-3" />,
    progressLabel: "Needs review",
    barClass: "bg-red-400",
  },
};

const partialErrorStyle = {
  label: "Partially completed",
  badgeClass: "bg-amber-50 text-amber-600",
  icon: <AlertCircle className="h-3 w-3" />,
  progressLabel: "Under review",
  barClass: "bg-amber-400",
};

// The backend can leave a function's status/errors from an earlier failed
// attempt in place even after a subsequent retry pushes every record
// successfully. When the counts already prove all extracted records made
// it to MYOB, trust the counts over a stale "error" status from the API.
// A function with nothing extracted has nothing left to push, so it counts as
// done (unless it's actively running or failed).
const getEffectiveStatus = (record: MigrationRecord): MigrationRecord["status"] => {
  if (record.count > 0 && record.migrated >= record.count) {
    return "completed";
  }
  if (
    record.count === 0 &&
    record.status !== "in-progress" &&
    record.status !== "error"
  ) {
    return "completed";
  }
  return record.status;
};

interface PhaseInfo {
  phase: MigrationPhase;
  currentFunction: string | null;
  completed: number;
  total: number;
}

// Older backends don't report a phase, so approximate it from the counts:
// nothing extracted yet means we're still fetching, any pushed/failed record
// means writing has started.
const derivePhase = (status: MigrationStatus): PhaseInfo => {
  if (status.phase) {
    return {
      phase: status.phase,
      currentFunction: status.current_function ?? null,
      completed: status.phase_completed ?? 0,
      total: status.phase_total ?? 0,
    };
  }

  const inProgress = status.records?.find((r) => r.status === "in-progress");
  let phase: MigrationPhase = "fetching";
  if (status.status === "completed") phase = "completed";
  else if ((status.records_migrated || 0) + (status.total_errors || 0) > 0) phase = "writing";

  return {
    phase,
    currentFunction: phase === "writing" ? inProgress?.name ?? null : null,
    completed: 0,
    total: 0,
  };
};

// Headline + supporting copy for the status card above the details table.
const getBannerCopy = (
  phase: MigrationPhase | undefined,
  isComplete: boolean,
  failedCount: number
): { title: string; message: string } => {
  if (isComplete) {
    return {
      title: "Your data migration has finished",
      message:
        failedCount > 0
          ? `Your data has been transferred to ${TARGET_NAME}. A few items (${failedCount}) are incomplete and our experts are reviewing them. We'll email you with details — no action is needed from you.`
          : `All of your data has been transferred to ${TARGET_NAME}. You can download a comparative report below.`,
    };
  }
  if (phase === "writing") {
    return {
      title: `Moving your data into ${TARGET_NAME}`,
      message: `We're writing your records into ${TARGET_NAME}. Please keep this page open — it updates automatically.`,
    };
  }
  if (phase === "fetching") {
    return {
      title: `Reading your data from ${SOURCE_NAME}`,
      message: `We're extracting your records from ${SOURCE_NAME}. Please keep this page open — it updates automatically.`,
    };
  }
  return {
    title: "Preparing your migration",
    message: "We're getting everything ready. This page will update as soon as the migration starts.",
  };
};

const InfoTile = ({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
}) => (
  <div
    className={
      highlight
        ? "rounded-lg bg-[#1f6aa5] px-5 py-4 text-white"
        : "rounded-lg bg-slate-100 px-5 py-4 text-slate-900"
    }
  >
    <p className="text-sm font-semibold">{label}</p>
    <p className="mt-0.5 break-words text-[15px]">{value}</p>
  </div>
);

const ProgressBar = ({ value, barClass }: { value: number; barClass: string }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
    <div
      className={`h-full rounded-full transition-all ${barClass}`}
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

const MigrationProgress = ({
  onComplete,
  fileId,
  xeroToolId,
  reckonToolId,
}: MigrationProgressProps) => {
  const [records, setRecords] = useState<MigrationRecord[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [recordsMigrated, setRecordsMigrated] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);
  const [recordsDialogOpen, setRecordsDialogOpen] = useState(false);
  const [selectedFunctionName, setSelectedFunctionName] = useState("");
  const [tableRecords, setTableRecords] = useState<MigrationRecordData[]>([]);
  const [tableRecordsTotal, setTableRecordsTotal] = useState(0);
  const [tableRecordsLoading, setTableRecordsLoading] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [phaseInfo, setPhaseInfo] = useState<PhaseInfo | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Customer Info step normally writes these to localStorage keyed by job id, but a
  // job can also be reached by reusing an existing Job ID (e.g. jumping straight to
  // Connect Accounts, or visiting /migration-progress/:jobId directly) without that
  // step running in this browser session. In that case fall back to whatever the job
  // status response reports below.
  const [fileName, setFileName] = useState<string>(() => {
    const id = getStoredJobId();
    return (id ? readStoredFileName(id) : null) ?? "—";
  });
  const [startDate, setStartDate] = useState<string | null>(() => {
    const id = getStoredJobId();
    return id ? readStoredDates(id).start : null;
  });
  const [endDate, setEndDate] = useState<string | null>(() => {
    const id = getStoredJobId();
    return id ? readStoredDates(id).end : null;
  });

  useEffect(() => {
    let pollingCleanup: (() => void) | null = null;

    const initializeMigration = async () => {
      const storedJobId = localStorage.getItem("jobId");

      if (storedJobId) {
        const existingJobId = Number(storedJobId);
        setJobId(existingJobId);
        setFileName(readStoredFileName(existingJobId) ?? "—");
        const stored = readStoredDates(existingJobId);
        setStartDate(stored.start);
        setEndDate(stored.end);
        setIsStarting(false);
        pollingCleanup = startPolling(existingJobId);
        return;
      }

      if (!fileId || !xeroToolId || !reckonToolId) {
        setError(
          "Missing required information. Please go back and complete previous steps."
        );
        setIsStarting(false);
        return;
      }

      try {
        const today = new Date().toISOString().split("T")[0];

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const startDate = oneYearAgo.toISOString().split("T")[0];

        const functions = [
          "Chart of account",
          "Customer",
          "Supplier",
          "Invoice",
          "Bill",
          "Invoice Payment",
          "Bill Payment",
        ];

        const jobResponse = await api.createJob(
          fileId,
          xeroToolId,
          reckonToolId,
          functions,
          startDate,
          today
        );

        if (jobResponse.error) {
          setError(jobResponse.error.message);
          setIsStarting(false);
          return;
        }

        if (jobResponse.data) {
          const createdJobId = jobResponse.data.id;

          setJobId(createdJobId);
          localStorage.setItem("jobId", String(createdJobId));
          localStorage.setItem(`migrationStartDate_${createdJobId}`, startDate);
          localStorage.setItem(`migrationEndDate_${createdJobId}`, today);
          setStartDate(startDate);
          setEndDate(today);
          // Carry over whatever file name was already resolved (e.g. from Customer
          // Info earlier in this session) so a later direct visit to this job's own
          // URL can resolve it without waiting on the backend status fallback below.
          setFileName((prev) => {
            if (prev && prev !== "—") {
              localStorage.setItem(`migrationFileName_${createdJobId}`, prev);
            }
            return prev;
          });

          // /startjobmigration only responds once the whole migration has run,
          // so start polling first; otherwise the fetching/writing status would
          // never be visible while the migration is actually in progress.
          setPhaseInfo({ phase: "fetching", currentFunction: null, completed: 0, total: 0 });
          setIsStarting(false);
          pollingCleanup = startPolling(createdJobId);

          toast({
            title: "Migration Started",
            description: "Data migration started successfully",
          });

          const startResponse = await api.startMigration(createdJobId);

          if (startResponse.error) {
            toast({
              title: "Migration Error",
              description: startResponse.error.message,
              variant: "destructive",
            });
          }
        }
      } catch (err) {
        setError("Unexpected error occurred");
        setIsStarting(false);
      }
    };

    initializeMigration();

    return () => {
      if (pollingCleanup) pollingCleanup();
    };
  }, [fileId, xeroToolId, reckonToolId]);

  const startPolling = (jobId: number): (() => void) => {
    let interval: number | undefined;

    const fetchStatus = async () => {
      try {
        const response = await api.getJobStatus(jobId);

        if (response.data) {
          const status = response.data;

          setOverallProgress(status.progress || 0);
          setTotalRecords(status.total_records || 0);
          setRecordsMigrated(status.records_migrated || 0);
          setTotalErrors(status.total_errors || 0);
          setPhaseInfo(derivePhase(status));

          // The backend is the source of truth for this specific jobId, so always
          // trust it over whatever was hydrated from localStorage on mount — that
          // guards against a stale/cross-job value (e.g. left over from an older
          // global localStorage key) permanently masking the correct one.
          const backendFileName = status.company_name || status.file_name;
          if (backendFileName) {
            setFileName(backendFileName);
            localStorage.setItem(`migrationFileName_${jobId}`, backendFileName);
          }
          if (status.start_date) {
            setStartDate(status.start_date);
            localStorage.setItem(`migrationStartDate_${jobId}`, status.start_date);
          }
          if (status.end_date) {
            setEndDate(status.end_date);
            localStorage.setItem(`migrationEndDate_${jobId}`, status.end_date);
          }

          if (status.records) {
            const updatedRecords = status.records.map((record: any) => ({
              id: record.id,
              name: record.name,
              count: record.count || 0,
              status: record.status,
              progress: record.progress || 0,
              migrated: record.migrated || 0,
              errors: record.errors || 0,
            }));

            setRecords(updatedRecords);
          }

          // A job that finishes with failed records reports status "error", but
          // its phase still moves to "completed" once every write task is done.
          if (status.status === "completed" || status.phase === "completed") {
            setIsComplete(true);
            clearInterval(interval);

            toast({
              title: "Migration Complete",
              description: status.total_errors
                ? `${status.records_migrated} records migrated, ${status.total_errors} failed`
                : `${status.records_migrated} records migrated`,
            });
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchStatus();

    interval = window.setInterval(fetchStatus, 2000);

    return () => {
      if (interval) clearInterval(interval);
    };
  };

  const handleViewRecords = async (record: MigrationRecord) => {
    const tableName = RECORD_ID_TO_TABLE[record.id];

    if (!jobId || !tableName) {
      toast({
        title: "Not available",
        description: "Records view isn't available for this function yet.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFunctionName(record.name);
    setRecordsDialogOpen(true);
    setTableRecordsLoading(true);

    const res = await api.getJobRecords(jobId, tableName, { limit: 200 });

    if (res.error) {
      toast({
        title: "Error",
        description: res.error.message || "Failed to load records",
        variant: "destructive",
      });
      setTableRecords([]);
      setTableRecordsTotal(0);
    } else {
      setTableRecords(res.data?.records || []);
      setTableRecordsTotal(res.data?.total || 0);
    }

    setTableRecordsLoading(false);
  };

  // Asks the backend to build every year's comparative trial balance PDF from
  // the live Xero/Reckon balances, then saves each one to the user's machine.
  const handleDownloadReport = async () => {
    if (!jobId) return;
    setIsGeneratingReport(true);

    try {
      const results = await Promise.all(
        COMPARATIVE_REPORT_YEARS.map((year) => api.fetchComparativeReport(jobId, year))
      );
      const files = results.flatMap((res) => (res.data ? [res.data] : []));

      if (files.length === 0) {
        // 404 for every year = no matched trial balance yet; surface any other error first.
        const realError = results.find((res) => res.error && res.error.status !== 404)?.error;
        throw new Error(
          realError?.message ||
            "The comparative report isn't ready yet. It becomes available once the migration finishes."
        );
      }

      files.forEach((file, index) => {
        const url = URL.createObjectURL(file.blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.fileName;
        document.body.appendChild(link);
        // Stagger clicks so browsers don't drop the second download.
        setTimeout(() => {
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }, index * 400);
      });

      toast({
        title: files.length > 1 ? "Reports downloaded" : "Report downloaded",
        description: files.map((file) => file.fileName).join(", "),
      });
    } catch (err) {
      toast({
        title: "Couldn't generate report",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Once the job is done, show 100% even if some records failed.
  const displayProgress = isComplete ? 100 : overallProgress;
  const banner = getBannerCopy(phaseInfo?.phase, isComplete, totalErrors);

  if (isStarting) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-bold">Initializing Migration...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p>{error}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-4 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold text-slate-900">Your Migration Tracker</h1>

        <div className="space-y-4 rounded-xl bg-white p-4 shadow-sm sm:p-5">
          {/* Summary tiles */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoTile label="Company Name" value={fileName} highlight />
            <InfoTile
              label="Migration Path"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {SOURCE_NAME} <ArrowRight className="h-4 w-4" /> {TARGET_NAME}
                </span>
              }
            />
            <InfoTile label="Start Date" value={formatDate(startDate)} />
            <InfoTile label="End Date" value={formatDate(endDate)} />
          </div>

          {/* Status banner */}
          <div
            className="flex flex-col gap-5 rounded-lg border border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between"
            aria-live="polite"
          >
            <div className="min-w-0 flex-1">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-[#1f6aa5]">
                {banner.title}
                {!isComplete && <Loader2 className="h-4 w-4 animate-spin" />}
              </h2>
              <p className="mt-1 text-sm text-slate-700">{banner.message}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={handleDownloadReport}
                  disabled={!jobId || isGeneratingReport}
                  className="bg-[#1f6aa5] font-semibold text-white hover:bg-[#1a5a8c]"
                >
                  {isGeneratingReport && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isGeneratingReport ? "Generating Report…" : "Get Comparative Report"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setHelpDialogOpen(true)}
                  disabled={!jobId}
                  className="font-semibold"
                >
                  Request Help
                </Button>
              </div>
            </div>

            <div className="w-full shrink-0 rounded-lg bg-[#1f6aa5] px-5 py-4 text-white lg:w-72">
              <p className="text-sm font-semibold">Overall Progress</p>
              <p className="mt-0.5 text-[15px]">{Math.round(displayProgress)}%</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/30">
                <div
                  className="h-full rounded-full bg-white transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, displayProgress))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Migration Details Table */}
          <div className="rounded-lg border border-slate-100">
            <h2 className="px-5 py-4 text-base font-semibold text-slate-900">Migration Details</h2>

            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="pl-5">Sequence</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Extracted from {SOURCE_NAME}</TableHead>
                  <TableHead>Pushed to {TARGET_NAME}</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead className="min-w-[180px]">Progress</TableHead>
                  <TableHead>Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Waiting for migration details…
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record, index) => {
                    const effectiveStatus = getEffectiveStatus(record);
                    // Some records pushed, the rest failed: finished, but with errors.
                    const partiallyFailed = effectiveStatus === "error" && record.migrated > 0;
                    const style = partiallyFailed ? partialErrorStyle : statusStyles[effectiveStatus];
                    const percent =
                      effectiveStatus === "completed" ? 100 : Math.round(record.progress);
                    const detail =
                      effectiveStatus === "error" && !partiallyFailed
                        ? `${record.errors} failed`
                        : `${style.label} ${record.migrated}/${record.count}`;
                    const canReview = !!RECORD_ID_TO_TABLE[record.id] && !!jobId;

                    return (
                      <TableRow key={record.id} className="text-[13px]">
                        <TableCell className="pl-5 text-slate-400">
                          {String(index + 1).padStart(2, "0")}
                        </TableCell>
                        <TableCell className="font-medium text-slate-800">{record.name}</TableCell>
                        <TableCell>{record.count}</TableCell>
                        <TableCell>{record.migrated}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badgeClass}`}
                          >
                            {style.icon}
                            {style.label}
                          </span>
                          <p className="mt-1 text-xs text-slate-400">{detail}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">{style.progressLabel}</span>
                            <span className="font-semibold text-emerald-500">{percent}%</span>
                          </div>
                          <div className="mt-1">
                            <ProgressBar value={percent} barClass={style.barClass} />
                          </div>
                        </TableCell>
                        <TableCell>
                          {canReview ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[#1f6aa5]"
                              onClick={() => handleViewRecords(record)}
                            >
                              <Eye className="mr-1 h-3.5 w-3.5" />
                              View
                            </Button>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <RequestHelpDialog
        open={helpDialogOpen}
        onOpenChange={setHelpDialogOpen}
        jobId={jobId}
      />
      {/* All Records Dialog */}
      <Dialog open={recordsDialogOpen} onOpenChange={setRecordsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedFunctionName} Records</DialogTitle>
            <DialogDescription>
              {tableRecordsLoading
                ? "Loading records…"
                : `Showing ${tableRecords.length} of ${tableRecordsTotal} records`}
            </DialogDescription>
          </DialogHeader>

          {tableRecordsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : tableRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">No records found.</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRecords.map((rec, idx) => {
                    const isPushed =
                      rec.is_pushed === 1 || rec.is_pushed === "1" || rec.is_pushed === true;
                    const hasError = !!rec.error && String(rec.error).trim() !== "";
                    const fields = Object.keys(rec).filter(
                      (key) => !RECORD_EXCLUDED_FIELDS.includes(key)
                    );

                    return (
                      <TableRow key={rec._id || idx}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {isPushed ? (
                              <Badge className="w-fit bg-primary/20 text-primary">Migrated</Badge>
                            ) : (
                              <Badge variant="outline" className="w-fit">
                                Pending
                              </Badge>
                            )}
                            {hasError && (
                              <Badge variant="destructive" className="w-fit">
                                Error
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-xs">
                            {fields.map((key) => (
                              <div key={key}>
                                <span className="font-medium text-muted-foreground">{key}:</span>{" "}
                                <span className="text-foreground">
                                  {rec[key] !== null && rec[key] !== undefined
                                    ? String(rec[key])
                                    : "N/A"}
                                </span>
                              </div>
                            ))}
                            {hasError && (
                              <div className="mt-2 rounded bg-destructive/10 p-2 text-destructive">
                                {rec.error}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MigrationProgress;
