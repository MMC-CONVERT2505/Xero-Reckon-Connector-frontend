import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, MigrationDetails, ErrorRecord, MigrationRecordData } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Save, X } from "lucide-react";

import { Loader2, ArrowLeft, Eye, AlertCircle, Database, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// Map record IDs to table names
const RECORD_ID_TO_TABLE: Record<string, string> = {
  "accounts": "xero_coa",
  "customers": "xero_customer",
  "suppliers": "xero_supplier",
  "invoices": "xero_invoice",
  "bills": "xero_bill",
  "payments": "xero_invoice_payment",
};

const AdminMigrationDetails = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [details, setDetails] = useState<MigrationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(true);
  const [retryingRecordId, setRetryingRecordId] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRecordName, setSelectedRecordName] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [errorsData, setErrorsData] = useState<ErrorRecord[]>([]);
  const [errorsLoading, setErrorsLoading] = useState(false);

  // For viewing all records
  const [recordsDialogOpen, setRecordsDialogOpen] = useState(false);
  const [recordsData, setRecordsData] = useState<MigrationRecordData[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const [editingPayload, setEditingPayload] = useState<{
    recordId: string;
    payload: any;
  } | null>(null);
  const [editedPayloadText, setEditedPayloadText] = useState<string>("");
  

  const numericJobId = Number(jobId);

  

  const loadDetails = async () => {
    if (!numericJobId) return;

    try {
      const res = await api.getMigrationDetails(numericJobId);
      
      if (res.error) {
        setError(res.error.message || "Failed to load migration details");
        toast({
          title: "Error",
          description: res.error.message || "Failed to load migration details",
          variant: "destructive",
        });
      } else if (res.data) {
        setDetails(res.data);
        setError(null);
        setLastUpdated(new Date());
      }
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load migration details");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!numericJobId) return;

    let cancelled = false;
    let interval: number | undefined;

    // Initial load
    setLoading(true);
    loadDetails();

    // Poll every 2 seconds if polling is enabled
    if (isPolling) {
      interval = window.setInterval(() => {
        if (!cancelled) {
          loadDetails();
        }
      }, 2000);
    }

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [numericJobId, isPolling]);

  const handleRefresh = () => {
    setLoading(true);
    loadDetails();
  };

  const openFailedRecords = async (recordId: string, recordName: string) => {
    if (!numericJobId) return;
    setSelectedRecordName(recordName);
    setSelectedRecordId(recordId);
    setErrorsLoading(true);
    setDialogOpen(true);
  
    const res = await api.getMigrationErrors(numericJobId, recordId);
    if (res.error) {
      toast({
        title: "Error",
        description: res.error.message || "Failed to load failed records",
        variant: "destructive",
      });
      setErrorsData([]);
    } else {
      setErrorsData(res.data || []);
    }
    setErrorsLoading(false);
  };

  const openAllRecords = async (recordId: string, recordName: string) => {
    if (!numericJobId) return;
    const tableName = RECORD_ID_TO_TABLE[recordId];
    if (!tableName) {
      toast({
        title: "Error",
        description: "Unknown record type",
        variant: "destructive",
      });
      return;
    }

    setSelectedRecordName(recordName);
    setSelectedRecordId(recordId);
    setRecordsLoading(true);
    setRecordsDialogOpen(true);

    try {
      const res = await api.getJobRecords(numericJobId, tableName, { limit: 200 });
      if (res.error) {
        toast({
          title: "Error",
          description: res.error.message || "Failed to load records",
          variant: "destructive",
        });
        setRecordsData([]);
      } else {
        setRecordsData(res.data?.records || []);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to load records",
        variant: "destructive",
      });
      setRecordsData([]);
    } finally {
      setRecordsLoading(false);
    }
  };

  

  const handleRetrySingleRecord = async (recordId: string, tableName: string, editedPayload?: any) => {
    if (!numericJobId || !recordId) return;
  
    setRetryingRecordId(recordId);
  
    try {
      const res = await api.retrySingleRecord(numericJobId, recordId, tableName, editedPayload);
      
      if (res.error) {
        toast({
          title: "Retry failed",
          description: res.error.message || "Could not retry record",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Record queued",
          description: "Record has been queued for retry",
        });
        
        // Close edit dialog if open
        setEditingPayload(null);
        
        // Refresh the records list after a short delay
        setTimeout(() => {
          // If failed records dialog is open, refresh it
          if (dialogOpen && selectedRecordId) {
            openFailedRecords(selectedRecordId, selectedRecordName || "");
          }
          // If all records dialog is open, refresh it
          if (recordsDialogOpen && selectedRecordId) {
            const tableNameForRefresh = RECORD_ID_TO_TABLE[selectedRecordId];
            if (tableNameForRefresh) {
              openAllRecords(selectedRecordId, selectedRecordName || "");
            }
          }
          // Also refresh the main details
          loadDetails();
        }, 1000);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to retry record",
        variant: "destructive",
      });
    } finally {
      setRetryingRecordId(null);
    }
  };

  const handleEditPayload = (record: ErrorRecord | MigrationRecordData) => {
    const payload = record.payload;
    const payloadText = typeof payload === 'string' 
      ? payload 
      : JSON.stringify(payload, null, 2);
    
    setEditingPayload({
      recordId: record._id || '',
      payload: payload,
    });
    setEditedPayloadText(payloadText);
  };
  
  // Update handleSaveAndRetry function (around line 240-260):
const handleSaveAndRetry = () => {
  if (!editingPayload) return;
  
  try {
    // Try to parse as JSON, if it fails, use as string
    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(editedPayloadText);
    } catch {
      // If it's not valid JSON, use as string
      parsedPayload = editedPayloadText;
    }
    
    // Determine which dialog is open and get the appropriate table name
    let tableName: string | null = null;
    
    if (dialogOpen && selectedRecordId) {
      // Failed records dialog is open
      tableName = RECORD_ID_TO_TABLE[selectedRecordId];
    } else if (recordsDialogOpen && selectedRecordId) {
      // All records dialog is open
      tableName = RECORD_ID_TO_TABLE[selectedRecordId];
    }
    
    if (tableName && editingPayload.recordId) {
      handleRetrySingleRecord(editingPayload.recordId, tableName, parsedPayload);
    } else {
      toast({
        title: "Error",
        description: "Could not determine table name for retry",
        variant: "destructive",
      });
    }
  } catch (err) {
    toast({
      title: "Invalid JSON",
      description: "Please check your payload format",
      variant: "destructive",
    });
  }
};

  const handleRetry = async (recordId?: string) => {
    if (!numericJobId) return;
    const res = await api.retryMigration(numericJobId, recordId);
    if (res.error) {
      toast({
        title: "Retry failed",
        description: res.error.message || "Could not retry migration",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Retry started",
        description: res.data?.message || "Retry triggered successfully",
      });
      // Refresh after retry
      setTimeout(() => loadDetails(), 1000);
    }
  };

  const renderRecordFields = (record: MigrationRecordData | ErrorRecord) => {
    const excludeFields = ["_id", "job_id", "task_id", "is_pushed", "error", "table_name", "payload"];
    const fields = Object.keys(record).filter((key) => !excludeFields.includes(key));
    
    return fields.map((key) => (
      <div key={key} className="text-xs">
        <span className="font-medium text-muted-foreground">{key}:</span>{" "}
        <span className="text-foreground">
          {record[key] !== null && record[key] !== undefined ? String(record[key]) : "N/A"}
        </span>
      </div>
    ));
  };

  if (loading && !details) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-destructive">{error || "Migration not found"}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/admin")}>
            Back to Admin Dashboard
          </Button>
          <Button variant="outline" onClick={handleRefresh}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">
                  Migration #{details.job_id}
                </h1>
                {isPolling && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Wifi className="w-4 h-4 text-green-500 animate-pulse" />
                    <span>Live</span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Status: <Badge className="ml-1">{details.status}</Badge> ·{" "}
              Progress: {Math.round(details.progress)}%
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                Total records: {details.total_records.toLocaleString()} · Migrated:{" "}
                {details.records_migrated.toLocaleString()} · Errors:{" "}
                {details.total_errors.toLocaleString()}
              </span>
              {lastUpdated && (
                <span>· Last updated: {lastUpdated.toLocaleTimeString()}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPolling(!isPolling)}
            >
              {isPolling ? (
                <>
                  <WifiOff className="w-4 h-4 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4 mr-2" />
                  Resume
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => handleRetry()}>
              Retry all failed
            </Button>
          </div>
        </header>

        {/* Overall Progress Bar */}
        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Progress</span>
            <span className="text-sm font-medium">{Math.round(details.progress)}%</span>
          </div>
          <Progress value={details.progress} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{details.records_migrated.toLocaleString()} migrated</span>
            <span>{details.total_records.toLocaleString()} total</span>
            {details.total_errors > 0 && (
              <span className="text-destructive">{details.total_errors.toLocaleString()} errors</span>
            )}
          </div>
        </div>

        {/* Functions / record types table */}
        <div className="border rounded-lg bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Function / Record Type</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Pushed</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No records for this migration.
                  </TableCell>
                </TableRow>
              ) : (
                details.records.map((r) => (
                  <TableRow key={r.id} className="transition-colors">
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.count.toLocaleString()}</TableCell>
                    <TableCell className="text-primary font-medium">
                      {r.migrated.toLocaleString()}
                    </TableCell>
                    <TableCell className={r.errors > 0 ? "text-destructive font-medium" : ""}>
                      {r.errors.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={r.progress} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground">{Math.round(r.progress)}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAllRecords(r.id, r.name)}
                      >
                        <Database className="w-4 h-4 mr-1" />
                        View All
                      </Button>
                      {r.errors > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openFailedRecords(r.id, r.name)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Failed
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetry(r.id)}
                      >
                        Retry
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Failed records dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
  <DialogContent className="max-w-4xl max-h-[80vh]">
    <DialogHeader>
      <DialogTitle>
        Failed records {selectedRecordName ? `– ${selectedRecordName}` : ""}
      </DialogTitle>
      <DialogDescription>
        Showing all records that failed for this function, with error messages. Click retry to retry individual records.
      </DialogDescription>
    </DialogHeader>

    {errorsLoading ? (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    ) : errorsData.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        No failed records found.
      </p>
    ) : (
      <div className="max-h-[60vh] overflow-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Details</TableHead>
              <TableHead>Error</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errorsData.map((er, idx) => {
              const recordId = er._id || String(idx);
              const tableName = selectedRecordId ? RECORD_ID_TO_TABLE[selectedRecordId] : null;
              const isRetrying = retryingRecordId === recordId;
              const canRetry = tableName && recordId && er._id; // Only retry if we have _id and table name

              return (
                <TableRow key={recordId}>
  <TableCell className="text-xs">
    <div className="space-y-1">
      {renderRecordFields(er)}
      {/* Show payload if available */}
      {er.payload && (
        <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
          <div className="flex items-center justify-between mb-1">
            <strong className="text-muted-foreground">Payload:</strong>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2"
              onClick={() => handleEditPayload(er)}
            >
              <Edit className="w-3 h-3 mr-1" />
              Edit
            </Button>
          </div>
          <pre className="mt-1 whitespace-pre-wrap break-words text-foreground">
            {typeof er.payload === 'string' 
              ? er.payload 
              : JSON.stringify(er.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  </TableCell>
  <TableCell className="text-xs">
    <div className="p-2 bg-destructive/10 rounded text-destructive whitespace-pre-wrap">
      {er.error}
    </div>
  </TableCell>
  <TableCell className="text-right">
    {canRetry ? (
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleRetrySingleRecord(recordId, tableName!)}
        disabled={isRetrying}
      >
        {isRetrying ? (
          <>
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Retrying...
          </>
        ) : (
          "Retry"
        )}
      </Button>
    ) : (
      <span className="text-xs text-muted-foreground">-</span>
    )}
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
      {/* All records dialog */}
      
{/* All records dialog */}
<Dialog open={recordsDialogOpen} onOpenChange={setRecordsDialogOpen}>
  <DialogContent className="max-w-5xl max-h-[80vh]">
    <DialogHeader>
      <DialogTitle>
        All Records {selectedRecordName ? `– ${selectedRecordName}` : ""}
      </DialogTitle>
      <DialogDescription>
        View all migrated records for this function. Click retry to retry failed records.
      </DialogDescription>
    </DialogHeader>
    {recordsLoading ? (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    ) : recordsData.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        No records found.
      </p>
    ) : (
      <div className="max-h-[60vh] overflow-auto border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recordsData.map((rec, idx) => {
              const recordId = rec._id || String(idx);
              const tableName = selectedRecordId ? RECORD_ID_TO_TABLE[selectedRecordId] : null;
              const isRetrying = retryingRecordId === recordId;
              const hasError = rec.error && rec.error.trim() !== "";
              const isNotPushed = rec.is_pushed !== 1 && rec.is_pushed !== "1" && rec.is_pushed !== true;
              const canRetry = tableName && (hasError || isNotPushed);

              return (
                <TableRow key={recordId}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {rec.is_pushed === 1 || rec.is_pushed === "1" || rec.is_pushed === true ? (
                        <Badge className="bg-primary/20 text-primary w-fit">
                          Migrated
                        </Badge>
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
                      {renderRecordFields(rec)}
                      {/* Show payload if available with Edit button */}
                      {rec.payload && (
                        <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <strong className="text-muted-foreground">Payload:</strong>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => handleEditPayload(rec)}
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </Button>
                          </div>
                          <pre className="mt-1 whitespace-pre-wrap break-words text-foreground">
                            {typeof rec.payload === 'string' 
                              ? rec.payload 
                              : JSON.stringify(rec.payload, null, 2)}
                          </pre>
                        </div>
                      )}
                      {hasError && (
                        <div className="mt-2 p-2 bg-destructive/10 rounded text-destructive">
                          <strong>Error:</strong> {rec.error}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {canRetry ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetrySingleRecord(recordId, tableName!)}
                        disabled={isRetrying}
                      >
                        {isRetrying ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Retrying...
                          </>
                        ) : (
                          "Retry"
                        )}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
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

{/* Edit Payload Dialog - Place this AFTER the "All records dialog" but BEFORE the closing </div> */}
<Dialog open={editingPayload !== null} onOpenChange={(open) => !open && setEditingPayload(null)}>
  <DialogContent className="max-w-4xl max-h-[80vh]">
    <DialogHeader>
      <DialogTitle>Edit Payload</DialogTitle>
      <DialogDescription>
        Edit the payload data before retrying. Make sure the JSON is valid.
      </DialogDescription>
    </DialogHeader>
    
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Payload (JSON or Text)</label>
        <Textarea
          value={editedPayloadText}
          onChange={(e) => setEditedPayloadText(e.target.value)}
          className="font-mono text-xs min-h-[400px]"
          placeholder="Enter payload data..."
        />
      </div>
      
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => setEditingPayload(null)}
        >
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button
          onClick={handleSaveAndRetry}
          disabled={!editedPayloadText.trim()}
        >
          <Save className="w-4 h-4 mr-2" />
          Save & Retry
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
    </div>
  );
};

export default AdminMigrationDetails;