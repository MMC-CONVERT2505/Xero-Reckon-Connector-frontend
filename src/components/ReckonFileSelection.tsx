import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, AlertCircle } from "lucide-react";

interface ReckonFile {
  book_id: string;  // Changed from tenant_id
  book_name: string; // Changed from tenant_name
}

function ReckonFileSelection() {
  const [files, setFiles] = useState<ReckonFile[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null); // Changed from selectedTenantId
  const [loading, setLoading] = useState(true);
  const [jobId, setJobId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedJobId = localStorage.getItem("jobId");

    console.log("Stored Job ID:", storedJobId);

    if (!storedJobId) {
      setError("Job ID not found. Please complete the customer info step first.");
      setLoading(false);
      return;
    }

    setJobId(storedJobId);
    setLoading(true);
    setError(null);



    // Fetch Reckon files from backend
    fetch(`https://data-sync.mmcconvert.com/get-reckon-files?job_id=${storedJobId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then(async (res) => {
        console.log("Response status:", res.status);
        console.log("Response headers:", Object.fromEntries(res.headers.entries()));
        
        if (!res.ok) {
          const errorText = await res.text();
          console.error("Response error:", errorText);
          throw new Error(`HTTP ${res.status}: ${errorText || res.statusText}`);
        }
        
        const data = await res.json();
        console.log("Fetched Reckon files:", data);
        
        // Check if the response contains an error field (like your Flask API might return)
        if (data.error) {
          throw new Error(data.error);
        }
        
        const list: ReckonFile[] = data.files || [];
        setFiles(list);
        if (list.length > 0) {
          setSelectedBookId(list[0].book_id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading Reckon files - full error:", err);
        console.error("Error name:", err.name);
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
        
        // Check if it's a CORS error
        if (err.message === "Failed to fetch" || err.name === "TypeError") {
          setError(`CORS Error: Failed to fetch Reckon files. Please check that the backend allows requests from this origin. Error: ${err.message}`);
        } else {
          setError(`Failed to load Reckon organizations: ${err.message}`);
        }
        setLoading(false);
      });
  }, []);

  const handleConnect = async () => {
    if (!selectedBookId || !jobId) return; // Changed from selectedTenantId

    const selectedFile = files.find((f) => f.book_id === selectedBookId); // Changed from tenant_id
    if (!selectedFile) {
      setError("Selected file not found");
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      // Fix: use port 5001 and send book_id/book_name (or adjust if your backend expects different field names)
      const res = await fetch("https://data-sync.mmcconvert.com/stored_reckon_organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          book_id: selectedFile.book_id,      // Changed from tenant_id
          book_name: selectedFile.book_name,  // Changed from tenant_name
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Failed to connect to selected Reckon organization");
        setConnecting(false);
        return;
      }

      if (data.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        window.location.href = `/connect-accounts?reckon_connected=true`;
      }
    } catch (err) {
      console.error(err);
      setError("Failed to connect to selected Reckon organization");
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Reckon organizations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-xl p-6 md:p-8 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            Select Reckon Organization
          </h2>
          <p className="text-sm text-muted-foreground">
            Choose the Reckon file you want to connect for this migration.
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
            No Reckon organizations found for this job.
          </p>
        ) : (
          <div className="space-y-3">
            {files.map((file) => (
              <label
                key={file.book_id} // Changed from tenant_id
                className={`flex items-center justify-between px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedBookId === file.book_id // Changed from selectedTenantId === file.tenant_id
                    ? "border-secondary bg-secondary/5"
                    : "border-border hover:border-secondary/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="reckonFile"
                    value={file.book_id} // Changed from tenant_id
                    checked={selectedBookId === file.book_id} // Changed from selectedTenantId === file.tenant_id
                    onChange={() => setSelectedBookId(file.book_id)} // Changed from setSelectedTenantId(file.tenant_id)
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium text-foreground">
                      {file.book_name} {/* Changed from tenant_name */}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Book ID: {file.book_id} {/* Changed from Tenant ID: {file.tenant_id} */}
                    </p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        <Button
          className="w-full"
          disabled={!selectedBookId || connecting} // Changed from !selectedTenantId
          onClick={handleConnect}
        >
          {connecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            "Connect Reckon File"
          )}
        </Button>
      </Card>
    </div>
  );
}

export default ReckonFileSelection;