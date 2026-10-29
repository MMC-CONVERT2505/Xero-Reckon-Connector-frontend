import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  AlertCircle,
  Hash,
  FileText,
  Calendar,
  CalendarClock,
  RefreshCw as OverallProgressIcon,
  Search,
  Clock,
  CheckCircle2,
  Loader2 as InProgressIcon,
  ArrowRight,
  LogOut,
  Eye,
  LifeBuoy,
  DownloadCloud,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { api, MigrationPhase, MigrationRecordData, MigrationStatus } from "@/lib/api";
import MmcLogo from "./MmcLogo";
import XeroLogo from "./XeroLogo";
import ReckonLogo from "./ReckonLogo";
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

const STATUS_FILTERS = ["All Status", "Pending", "In Progress", "Completed", "Error"] as const;

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
  { label: string; badgeClass: string; icon: JSX.Element; progressClass: string }
> = {
  pending: {
    label: "Pending",
    badgeClass: "bg-muted text-muted-foreground",
    icon: <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />,
    progressClass: "text-muted-foreground",
  },
  "in-progress": {
    label: "In Progress",
    badgeClass: "bg-blue-50 text-blue-600",
    icon: <InProgressIcon className="h-3 w-3 animate-spin" />,
    progressClass: "text-blue-600",
  },
  completed: {
    label: "Completed",
    badgeClass: "bg-green-50 text-green-600",
    icon: <CheckCircle2 className="h-3 w-3" />,
    progressClass: "text-green-600",
  },
  error: {
    label: "Error",
    badgeClass: "bg-red-50 text-red-600",
    icon: <AlertCircle className="h-3 w-3" />,
    progressClass: "text-red-600",
  },
};

const partialErrorStyle = {
  label: "Completed with errors",
  badgeClass: "bg-amber-50 text-amber-600",
  icon: <AlertCircle className="h-3 w-3" />,
  progressClass: "text-amber-600",
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

const phaseStyles: Record<
  MigrationPhase,
  { title: string; containerClass: string; iconClass: string; icon: JSX.Element }
> = {
  pending: {
    title: "Preparing migration",
    containerClass: "border-muted bg-muted/40",
    iconClass: "bg-muted-foreground",
    icon: <Clock className="h-4 w-4" />,
  },
  fetching: {
    title: "Fetching data from Xero",
    containerClass: "border-blue-200 bg-blue-50",
    iconClass: "bg-blue-500",
    icon: <DownloadCloud className="h-4 w-4" />,
  },
  writing: {
    title: "Writing data to Reckon",
    containerClass: "border-amber-200 bg-amber-50",
    iconClass: "bg-amber-500",
    icon: <UploadCloud className="h-4 w-4" />,
  },
  completed: {
    title: "Migration completed",
    containerClass: "border-green-200 bg-green-50",
    iconClass: "bg-green-500",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
};

const PhaseBanner = ({ info }: { info: PhaseInfo }) => {
  const style = phaseStyles[info.phase];
  const isActive = info.phase === "fetching" || info.phase === "writing";

  return (
    <div
      className={`mt-4 flex items-center gap-3 rounded-lg border p-3 ${style.containerClass}`}
      aria-live="polite"
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${style.iconClass}`}
      >
        {style.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">
          {style.title}
          {isActive && info.currentFunction && (
            <span className="font-normal text-muted-foreground"> — {info.currentFunction}</span>
          )}
        </p>
        {isActive && info.total > 0 && (
          <p className="text-xs text-muted-foreground">
            {info.completed} of {info.total} functions{" "}
            {info.phase === "fetching" ? "fetched" : "written"}
          </p>
        )}
      </div>
      {isActive && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
    </div>
  );
};

const NavBar = ({ onLogout }: { onLogout: () => void }) => (
  <div className="flex items-center justify-between border-b bg-card px-4 py-3 sm:px-6">
    <MmcLogo className="h-8 w-auto" />

    <div className="flex items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-full border bg-background shadow-sm">
        <XeroLogo className="h-4 w-4" />
      </span>
      <ArrowRight className="h-4 w-4 text-muted-foreground" />
      <span className="flex h-8 w-8 items-center justify-center rounded-full border bg-background shadow-sm">
        <ReckonLogo className="h-4 w-4" />
      </span>
      <span className="ml-1 text-sm font-medium text-foreground">Reckon</span>
    </div>

    <Button variant="ghost" size="sm" onClick={onLogout}>
      <LogOut className="mr-2 h-4 w-4" />
      Logout
    </Button>
  </div>
);

const MigrationProgress = ({
  onComplete,
  fileId,
  xeroToolId,
  reckonToolId,
}: MigrationProgressProps) => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<MigrationRecord[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [recordsMigrated, setRecordsMigrated] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>("All Status");
  const [recordsDialogOpen, setRecordsDialogOpen] = useState(false);
  const [selectedFunctionName, setSelectedFunctionName] = useState("");
  const [tableRecords, setTableRecords] = useState<MigrationRecordData[]>([]);
  const [tableRecordsTotal, setTableRecordsTotal] = useState(0);
  const [tableRecordsLoading, setTableRecordsLoading] = useState(false);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [phaseInfo, setPhaseInfo] = useState<PhaseInfo | null>(null);

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

  const filteredRecords = records.filter((record) => {
    const matchesSearch = record.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "All Status" ||
      statusStyles[getEffectiveStatus(record)].label === statusFilter;

    return matchesSearch && matchesStatus;
  });

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

  const handleLogout = () => {
    if (jobId) {
      localStorage.removeItem(`migrationFileName_${jobId}`);
      localStorage.removeItem(`migrationStartDate_${jobId}`);
      localStorage.removeItem(`migrationEndDate_${jobId}`);
    }
    localStorage.removeItem("jobId");
    localStorage.removeItem("customerInfo");
    localStorage.removeItem("migrationStartDate");
    localStorage.removeItem("migrationEndDate");
    navigate("/");
  };

  // Once the job is done, show 100% even if some records failed.
  const displayProgress = isComplete ? 100 : overallProgress;

  if (isStarting) {
    return (
      <div>
        <NavBar onLogout={handleLogout} />
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-bold">Initializing Migration...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <NavBar onLogout={handleLogout} />
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p>{error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <NavBar onLogout={handleLogout} />

      <div className="space-y-6 p-4 sm:p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Migration Tracker</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Please keep this page open while your data is being transferred
          </p>
        </div>
        <Button
          onClick={() => setHelpDialogOpen(true)}
          disabled={!jobId}
          className="bg-amber-400 text-white hover:bg-amber-500"
        >
          <LifeBuoy />
          Request Help
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl p-4 bg-blue-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Job ID</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white">
              <Hash className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-foreground">{jobId ?? "—"}</p>
        </div>

        <div className="rounded-xl p-4 bg-indigo-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">File Name</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 text-white">
              <FileText className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-foreground break-words" title={fileName}>
            {fileName}
          </p>
        </div>

        <div className="rounded-xl p-4 bg-green-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Start Date</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white">
              <Calendar className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-foreground">{formatDate(startDate)}</p>
        </div>

        <div className="rounded-xl p-4 bg-orange-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">End Date</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white">
              <CalendarClock className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-foreground">{formatDate(endDate)}</p>
        </div>



        <div className="rounded-xl p-4 bg-purple-50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Overall Progress</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-500 text-white">
              <OverallProgressIcon className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-bold text-foreground">
            {Math.round(displayProgress)}%
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
              style={{ width: `${Math.min(100, Math.max(0, displayProgress))}%` }}
            />
          </div>
         
        </div>
      </div>

      {/* Migration Progress Section */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Migration Progress</h2>
            <p className="text-sm text-muted-foreground">
              Monitor data extraction and migration progress in real time.
            </p>
          </div>

          <div className="flex gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search functions..."
                className="w-56 pl-9"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as (typeof STATUS_FILTERS)[number])
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {phaseInfo && <PhaseBanner info={isComplete ? { ...phaseInfo, phase: "completed" } : phaseInfo} />}
      </div>

      {/* Migration Details Table */}
      <div className="rounded-xl border bg-card">
        <div className="p-5 pb-0">
          <h2 className="text-lg font-semibold text-foreground">Migration Details</h2>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sr.No</TableHead>
              <TableHead>Function</TableHead>
              <TableHead>Extracted from Xero</TableHead>
              <TableHead>Pushed to Reckon</TableHead>
              <TableHead>Status & Detail</TableHead>
              <TableHead className="text-right">Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No functions match your search.
                </TableCell>
              </TableRow>
            ) : (
              filteredRecords.map((record, index) => {
                const effectiveStatus = getEffectiveStatus(record);
                // Some records pushed, the rest failed: finished, but with errors.
                const partiallyFailed = effectiveStatus === "error" && record.migrated > 0;
                const style = partiallyFailed ? partialErrorStyle : statusStyles[effectiveStatus];
                const detail = partiallyFailed
                  ? `${record.migrated}/${record.count}`
                  : effectiveStatus === "error"
                    ? `${record.errors} failed`
                    : effectiveStatus === "pending"
                    ? `Pending ${record.migrated}/${record.count}`
                    : `${record.migrated}/${record.count}`;

                return (
                  <TableRow key={record.id}>
                    <TableCell className="text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </TableCell>
                    <TableCell className="font-medium">{record.name}</TableCell>
                    <TableCell>{record.count}</TableCell>
                    <TableCell>{record.migrated}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badgeClass}`}
                      >
                        {style.icon}
                        {style.label}
                      </span>
                      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <p className={`text-sm font-medium ${style.progressClass}`}>
                        {style.label}
                      </p>
                      <p className={`text-sm font-bold ${style.progressClass}`}>
                        {effectiveStatus === "completed" ? 100 : Math.round(record.progress)}%
                      </p>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
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
