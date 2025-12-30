import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";

interface XeroFile {
  tenant_id: string;
  tenant_name: string;
}


function XeroFileSelection() {
    // remove useSearchParams; just use localStorage jobId
    const [files, setFiles] = useState<XeroFile[]>([]);
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [jobId, setJobId] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
  
    useEffect(() => {
      const storedJobId = localStorage.getItem("jobId");
  
      if (!storedJobId) {
        setError("Job ID not found. Please complete the customer info step first.");
        setLoading(false);
        return;
      }
  
      setJobId(storedJobId);
      setLoading(true);
      setError(null);
  
      fetch(`https://xero-reckon-sync.mmcconvert.com/get-xero-files?job_id=${storedJobId}`)
        .then((res) => res.json())
        .then((data) => {
          const list: XeroFile[] = data.files || [];
          setFiles(list);
          if (list.length > 0) {
            setSelectedTenantId(list[0].tenant_id);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setError("Failed to load Xero organizations");
          setLoading(false);
        });
    }, []);
  
    const handleConnect = async () => {
        if (!selectedTenantId || !jobId) return;
      
        const selectedTenant = files.find((f) => f.tenant_id === selectedTenantId);
        if (!selectedTenant) {
          setError("Selected tenant not found");
          return;
        }
      
        setConnecting(true);
        setError(null);
      
        try {
          const res = await fetch("https://xero-reckon-sync.mmcconvert.com/stored_xero_organization", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              job_id: jobId,
              tenant_id: selectedTenant.tenant_id,
              tenant_name: selectedTenant.tenant_name,
            }),
          });
      
          const data = await res.json();
      
          if (!res.ok) {
            setError(data?.error || "Failed to connect to selected Xero organization");
            setConnecting(false);
            return;
          }
      
          // Navigate to the redirect URL from the response
          if (data.redirect_url) {
            window.location.href = data.redirect_url;
          } else {
            // Fallback if redirect_url not provided
            window.location.href = `/connect-accounts?xero_connected=true`;
          }
        } catch (err) {
          console.error(err);
          setError("Failed to connect to selected Xero organization");
          setConnecting(false);
        }
      };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Xero organizations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-xl p-6 md:p-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            Select Xero Organization
          </h2>
          <p className="text-sm text-muted-foreground">
            Choose the Xero file you want to connect for this migration.
          </p>
          {jobId && (
            <p className="text-xs text-muted-foreground">
              Job ID: <span className="font-mono">{jobId}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No Xero organizations found for this job.
          </p>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <label
                key={file.tenant_id}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedTenantId === file.tenant_id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="tenant"
                    value={file.tenant_id}
                    checked={selectedTenantId === file.tenant_id}
                    onChange={() => setSelectedTenantId(file.tenant_id)}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-foreground">
                      {file.tenant_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tenant ID: {file.tenant_id}
                    </p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        <Button
          className="w-full"
          disabled={!selectedTenantId || connecting}
          onClick={handleConnect}
        >
          {connecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            "Connect File"
          )}
        </Button>
      </Card>
    </div>
  );
}

export default XeroFileSelection;