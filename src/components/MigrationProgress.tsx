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

const MigrationProgress = ({ onComplete, fileId, xeroToolId, reckonToolId }: MigrationProgressProps) => {
  const [records, setRecords] = useState<MigrationRecord[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [recordsMigrated, setRecordsMigrated] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);

  // Initialize migration when component mounts
  useEffect(() => {
    let pollingCleanup: (() => void) | null = null;

    const initializeMigration = async () => {
      const storedJobId = localStorage.getItem("jobId");
      
      if (storedJobId) {
        const existingJobId = Number(storedJobId);
        setJobId(existingJobId);
        setIsStarting(false);
        // Start polling for real-time updates
        pollingCleanup = startPolling(existingJobId);
        return;
      }

      // Fallback: Only create job if jobId not found in localStorage
      if (!fileId || !xeroToolId || !reckonToolId) {
        setError("Missing required information. Please go back and complete the previous steps.");
        setIsStarting(false);
        return;
      }

      try {
        // Create job
        const today = new Date().toISOString().split('T')[0];
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const startDate = oneYearAgo.toISOString().split('T')[0];

        const functions = [
          'Chart of account',
          'Customer',
          'Supplier',
          'Invoice',
          'Bill',
          'Invoice Payment',
          'Bill Payment',
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
          setError(jobResponse.error.message || "Failed to create migration job");
          setIsStarting(false);
          return;
        }

        if (jobResponse.data) {
          const createdJobId = jobResponse.data.id;
          setJobId(createdJobId);
          localStorage.setItem("jobId", String(createdJobId));

          // Start the job
          const startResponse = await api.startMigration(createdJobId);
          
          if (startResponse.error) {
            setError(startResponse.error.message || "Failed to start migration");
            setIsStarting(false);
            return;
          }

          toast({
            title: "Migration Started",
            description: "Your data migration has been initiated successfully.",
          });

          setIsStarting(false);
          // Start polling for real-time updates
          pollingCleanup = startPolling(createdJobId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
        setIsStarting(false);
      }
    };

    initializeMigration();

    // Cleanup function for useEffect
    return () => {
      if (pollingCleanup) {
        pollingCleanup();
      }
    };
  }, [fileId, xeroToolId, reckonToolId]);

  // Poll for real-time status updates from MongoDB
  const startPolling = (jobId: number): (() => void) => {
    let interval: number | undefined;
    let isComplete = false;

    const fetchStatus = async () => {
      // Don't poll if already complete
      if (isComplete) {
        if (interval) clearInterval(interval);
        return;
      }

      try {
        const response = await api.getJobStatus(jobId);
        
        if (response.error) {
          console.error("Error fetching job status:", response.error);
          setError(response.error.message || "Failed to fetch migration status");
          return;
        }

        if (response.data) {
          const status = response.data;
          
          // Update overall progress
          setOverallProgress(status.progress || 0);
          
          // Update totals
          setTotalRecords(status.total_records || 0);
          setRecordsMigrated(status.records_migrated || 0);
          setTotalErrors(status.total_errors || 0);
          
          // Update records from API response
          if (status.records && status.records.length > 0) {
            const updatedRecords = status.records.map((record) => ({
              id: record.id,
              name: record.name,
              count: record.count || 0,
              status: record.status as MigrationRecord["status"],
              progress: record.progress || 0,
              migrated: record.migrated || 0,
              errors: record.errors || 0,
            }));
            setRecords(updatedRecords);
          } else {
            // If no records yet, show empty state
            setRecords([]);
          }
          
          // Check if migration is complete
          if (status.status === "completed") {
            isComplete = true;
            setIsComplete(true);
            if (interval) clearInterval(interval); // Stop polling
            toast({
              title: "Migration Complete",
              description: `Successfully migrated ${status.records_migrated} records`,
            });
          }
          
          // Handle errors
          if (status.status === "error" && status.total_errors > 0) {
            console.warn(`Migration has ${status.total_errors} errors`);
          }
        }
      } catch (err) {
        console.error("Error polling job status:", err);
        setError("Failed to fetch migration status. Please refresh the page.");
      }
    };

    // Fetch immediately
    fetchStatus();
    
    // Then poll every 2 seconds
    interval = window.setInterval(fetchStatus, 2000);
    
    // Return cleanup function
    return () => {
      if (interval) clearInterval(interval);
    };
  };

  const getStatusIcon = (status: MigrationRecord["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-primary" />;
      case "in-progress":
        return <Loader2 className="w-5 h-5 text-xero animate-spin" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-muted" />;
    }
  };

  if (isStarting) {
    return (
      <div className="animate-fade-in text-center py-12">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Initializing Migration...
        </h2>
        <p className="text-muted-foreground">
          Setting up your migration job
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in text-center py-12">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Migration Error
        </h2>
        <p className="text-muted-foreground mb-6">
          {error}
        </p>
        <Button onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-4 mb-4">
          <XeroLogo className="w-10 h-10" />
          <div className="flex items-center gap-1">
            {!isComplete ? (
              <>
                <div className="w-2 h-2 bg-xero rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-100" />
                <div className="w-2 h-2 bg-reckon rounded-full animate-pulse delay-200" />
              </>
            ) : (
              <CheckCircle2 className="w-6 h-6 text-primary" />
            )}
          </div>
          <ReckonLogo className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {isComplete ? "Migration Complete!" : "Migrating Data..."}
        </h2>
        <p className="text-muted-foreground">
          {isComplete
            ? "All records have been successfully transferred"
            : "Please wait while we transfer your data"}
        </p>
        {jobId && (
          <p className="text-xs text-muted-foreground mt-2">
            Job ID: {jobId}
          </p>
        )}
      </div>

      {/* Overall Progress */}
      <div className="mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Overall Progress</span>
          <span className="font-medium text-foreground">{Math.round(overallProgress)}%</span>
        </div>
        <Progress value={overallProgress} className="h-3" />
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>{recordsMigrated.toLocaleString()} records migrated</span>
          <span>{totalRecords.toLocaleString()} total</span>
          {totalErrors > 0 && (
            <span className="text-destructive">{totalErrors.toLocaleString()} errors</span>
          )}
        </div>
      </div>

      {/* Record List */}
      <div className="space-y-3">
        {records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No migration data available yet. Waiting for records...</p>
          </div>
        ) : (
          records.map((record) => (
            <div
              key={record.id}
              className={`p-4 rounded-lg border transition-all duration-300 ${
                record.status === "in-progress"
                  ? "bg-xero/5 border-xero/30"
                  : record.status === "completed"
                  ? "bg-primary/5 border-primary/30"
                  : record.status === "error"
                  ? "bg-destructive/5 border-destructive/30"
                  : "bg-muted/30 border-border/50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {getStatusIcon(record.status)}
                  <span className="font-medium text-foreground">{record.name}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  {record.migrated > 0 && (
                    <span className="text-primary">
                      {record.migrated.toLocaleString()} migrated
                    </span>
                  )}
                  {record.errors > 0 && (
                    <span className="text-destructive">
                      {record.errors.toLocaleString()} errors
                    </span>
                  )}
                  <span className="text-muted-foreground">
                    {record.count.toLocaleString()} total
                  </span>
                </div>
              </div>
              {(record.status === "in-progress" || record.status === "completed") && (
                <div className="ml-8 mt-2">
                  <Progress
                    value={record.progress}
                    className={`h-1.5 ${
                      record.status === "completed" 
                        ? "bg-primary/20" 
                        : record.errors > 0
                        ? "bg-destructive/20"
                        : "bg-xero/20"
                    }`}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{Math.round(record.progress)}%</span>
                    <span>{record.migrated}/{record.count}</span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Complete Button */}
      {isComplete && (
        <div className="mt-8 text-center animate-fade-in">
          <div className="p-4 bg-primary/10 rounded-lg mb-6">
            <p className="text-primary font-medium">
              ✓ Successfully migrated {recordsMigrated.toLocaleString()} records
            </p>
            {totalErrors > 0 && (
              <p className="text-destructive text-sm mt-1">
                ⚠ {totalErrors.toLocaleString()} records had errors
              </p>
            )}
          </div>
          <Button size="lg" onClick={onComplete}>
            View Summary
          </Button>
        </div>
      )}
    </div>
  );
};

export default MigrationProgress;