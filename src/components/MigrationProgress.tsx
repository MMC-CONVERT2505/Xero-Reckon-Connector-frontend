import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import XeroLogo from "./XeroLogo";
import ReckonLogo from "./ReckonLogo";
import { api } from "@/lib/api";

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

  useEffect(() => {
    let pollingCleanup: (() => void) | null = null;

    const initializeMigration = async () => {
      const storedJobId = localStorage.getItem("jobId");

      if (storedJobId) {
        const existingJobId = Number(storedJobId);
        setJobId(existingJobId);
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

          const startResponse = await api.startMigration(createdJobId);

          if (startResponse.error) {
            setError(startResponse.error.message);
            setIsStarting(false);
            return;
          }

          toast({
            title: "Migration Started",
            description: "Data migration started successfully",
          });

          setIsStarting(false);
          pollingCleanup = startPolling(createdJobId);
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

          if (status.status === "completed") {
            setIsComplete(true);
            clearInterval(interval);

            toast({
              title: "Migration Complete",
              description: `${status.records_migrated} records migrated`,
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

  const handleDownloadReport = async () => {
    try {
      if (!jobId) return;

      const response = await fetch(`/report_generation/${jobId}`, {
        method: "POST",
      });

      const data = await response.json();

      if (data.status === "success") {
        data.files.forEach((file: string) => {
          const link = document.createElement("a");
          link.href = file;
          link.download = "";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        });

        toast({
          title: "Report Downloaded",
          description: "Migration report downloaded successfully",
        });
      } else {
        toast({
          title: "Error",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

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
      {/* Header */}

      <div className="text-center mb-6">
        <div className="flex justify-center items-center gap-4 mb-3">
          <XeroLogo className="w-10 h-10" />
          <ReckonLogo className="w-10 h-10" />
        </div>

        <h2 className="text-xl font-bold">
          {isComplete ? "Migration Complete" : "Migrating Data"}
        </h2>

        {jobId && <p className="text-xs">Job ID: {jobId}</p>}
      </div>

      {/* Overall Progress */}

      <div className="mb-6">
        <div className="flex justify-between text-sm mb-1">
          <span>Overall Progress</span>
          <span>{Math.round(overallProgress)}%</span>
        </div>

        <Progress value={overallProgress} />

        <div className="text-xs mt-2 flex justify-between">
          <span>{recordsMigrated} migrated</span>
          <span>{totalRecords} total</span>
          {totalErrors > 0 && <span>{totalErrors} errors</span>}
        </div>
      </div>

      {/* Download Button after 10% */}

      {overallProgress >= 10 && (
        <div className="text-center mb-6">
          <Button onClick={handleDownloadReport}>Download Report</Button>
        </div>
      )}

      {/* Records */}

      <div className="space-y-3">
        {records.map((record) => (
          <div key={record.id} className="border p-4 rounded-lg">
            <div className="flex justify-between mb-2">
              <span>{record.name}</span>
              <span>{record.count}</span>
            </div>

            <Progress value={record.progress} />

            <div className="flex justify-between text-xs mt-1">
              <span>{record.progress}%</span>
              <span>
                {record.migrated}/{record.count}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Complete Button */}

      {isComplete && (
        <div className="text-center mt-8">
          <Button onClick={onComplete}>View Summary</Button>
        </div>
      )}
    </div>
  );
};

export default MigrationProgress;