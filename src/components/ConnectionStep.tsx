import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";  // Add this import
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Check, Link2, Loader2 } from "lucide-react";
import XeroLogo from "./XeroLogo";
import ReckonLogo from "./ReckonLogo";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface ConnectionStepProps {
  onComplete: () => void;
  fileId?: number | null;
  onToolIdsSet?: (xeroId: number, reckonId: number) => void;
}

const ConnectionStep = ({ onComplete, fileId, onToolIdsSet }: ConnectionStepProps) => {
  const navigate = useNavigate();  // Add this hook
  const [xeroConnected, setXeroConnected] = useState(false);
  const [reckonConnected, setReckonConnected] = useState(false);
  const [connecting, setConnecting] = useState<"xero" | "reckon" | null>(null);
  const [startingMigration, setStartingMigration] = useState(false);
  const [xeroToolId, setXeroToolId] = useState<number | null>(null);
  const [reckonToolId, setReckonToolId] = useState<number | null>(null);

  const handleStartMigration = async () => {
    const storedJobId = localStorage.getItem("jobId");
  
    if (!storedJobId) {
      toast({
        title: "Missing Job",
        description: "Job ID not found. Please complete the customer info step first.",
        variant: "destructive",
      });
      return;
    }
  
    setStartingMigration(true);
  
    try {
      const jobId = Number(storedJobId);
      // Fire the backend call - redirect is handled in api.startMigration
      const response = await api.startMigration(jobId);
      
      // Only show toast if redirect_url is not present (fallback)
      if (!response.data?.redirect_url) {
        toast({
          title: "Migration Started",
          description: `Migration started for job ID: ${jobId}`,
        });
        // Fallback: use React Router navigate if backend didn't provide redirect
        navigate("/migration-progress");
      }
      // If redirect_url is present, the redirect happens in api.startMigration
      // No need to call navigate() here
    } catch (error) {
      console.error("Error starting migration:", error);
      toast({
        title: "Error",
        description: "Failed to start migration. Please try again.",
        variant: "destructive",
      });
      setStartingMigration(false);
    }
  };
  // ... rest of your component code stays the same ...
  
  // Check if we're returning from OAuth callback
  // Check if we're returning from OAuth callback OR from file selection
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get("code");
  const xeroConnectedParam = urlParams.get("xero_connected");
  const reckonConnectedParam = urlParams.get("reckon_connected");

  // Case 1: came back from stored_xero_organization → ?xero_connected=true
  if (xeroConnectedParam === "true") {
    setXeroConnected(true);
    toast({
      title: "Xero Connected",
      description: "Successfully connected to your Xero account.",
    });
    // Clean up URL so the param doesn't hang around
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }

  // Case 2: came back from stored_reckon_organization → ?reckon_connected=true
  // When Reckon is connected, Xero should already be connected (from previous step)
  if (reckonConnectedParam === "true") {
    setXeroConnected(true); // Xero was connected in previous step
    setReckonConnected(true);
    toast({
      title: "Reckon Connected",
      description: "Successfully connected to your Reckon account.",
    });
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
    return;
  }

  // Case 3: existing OAuth callback logic
  if (code) {
    if (
      window.location.pathname.includes("create_auth_code") ||
      window.location.search.includes("xero")
    ) {
      setXeroConnected(true);
      toast({
        title: "Xero Connected",
        description: "Successfully connected to your Xero account.",
      });
    } else if (
      window.location.pathname.includes("reckon_callback") ||
      window.location.search.includes("reckon")
    ) {
      setReckonConnected(true);
      toast({
        title: "Reckon Connected",
        description: "Successfully connected to your Reckon account.",
      });
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }
}, []);

  const handleConnect = async (service: "xero" | "reckon") => {
    setConnecting(service);
  
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://data-sync.mmcconvert.com/";
  
      if (service === "xero") {
        // Get jobId from localStorage (saved earlier in CustomerInfoForm)
        const storedJobId = localStorage.getItem("jobId");
  
        if (!storedJobId) {
          toast({
            title: "Missing Job",
            description: "Job ID not found. Please complete the customer info step first.",
            variant: "destructive",
          });
          setConnecting(null);
          return;
        }
  
        const jobId = Number(storedJobId);
        setXeroToolId(jobId);
  
        // Redirect to your new Flask route: /source_xeroconnect/<id>
        window.location.href = `${API_BASE_URL}/source_xeroconnect/${jobId}`;
      } else {
        // Reckon stays as before (or adjust similarly if you have a new route)
        // or however you get this id

        const storedJobId = localStorage.getItem("jobId");
  
        if (!storedJobId) {
          toast({
            title: "Missing Job",
            description: "Job ID not found. Please complete the customer info step first.",
            variant: "destructive",
          });
          setConnecting(null);
          return;
        }
        const jobId = Number(storedJobId);
        
        
        setReckonToolId(jobId);
        window.location.href = `${API_BASE_URL}/destination_reckonone/${jobId}`;
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: `Failed to connect to ${service}. Please try again.`,
        variant: "destructive",
      });
      setConnecting(null);
    }
  };


  // Notify parent when both tool IDs are set
  useEffect(() => {
    if (xeroToolId && reckonToolId && onToolIdsSet) {
      onToolIdsSet(xeroToolId, reckonToolId);
    }
  }, [xeroToolId, reckonToolId, onToolIdsSet]);

  const bothConnected = xeroConnected && reckonConnected;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Connect Your Accounts
        </h2>
        <p className="text-muted-foreground">
          Link both platforms to enable secure data migration
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Xero Connection Card */}
        <div
          className={cn(
            "relative p-8 rounded-2xl border-2 transition-all duration-300",
            xeroConnected
              ? "border-primary bg-accent/50 shadow-glow-xero"
              : "border-border bg-card hover:border-primary/50"
          )}
        >
          {xeroConnected && (
            <div className="absolute top-4 right-4 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <Check className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <XeroLogo className="w-20 h-20" />
              {xeroConnected && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <Link2 className="w-3 h-3 text-primary-foreground" />
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground">Xero</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Source accounting platform
              </p>
            </div>
            <Button
              onClick={() => handleConnect("xero")}
              disabled={xeroConnected || connecting !== null}
              variant={xeroConnected ? "outline" : "default"}
              className={cn(
                "w-full",
                !xeroConnected && "bg-xero hover:bg-xero/90"
              )}
            >
              {connecting === "xero" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : xeroConnected ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Connected
                </>
              ) : (
                "Connect Xero"
              )}
            </Button>
          </div>
        </div>

        {/* Reckon Connection Card */}
        <div
          className={cn(
            "relative p-8 rounded-2xl border-2 transition-all duration-300",
            reckonConnected
              ? "border-secondary bg-secondary/10 shadow-glow-reckon"
              : "border-border bg-card hover:border-secondary/50"
          )}
        >
          {reckonConnected && (
            <div className="absolute top-4 right-4 w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
              <Check className="w-5 h-5 text-secondary-foreground" />
            </div>
          )}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <ReckonLogo className="w-20 h-20" />
              {reckonConnected && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-secondary rounded-full flex items-center justify-center">
                  <Link2 className="w-3 h-3 text-secondary-foreground" />
                </div>
              )}
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground">Reckon</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Destination accounting platform
              </p>
            </div>
            <Button
              onClick={() => handleConnect("reckon")}
              disabled={!xeroConnected || reckonConnected || connecting !== null}
              variant={reckonConnected ? "outline" : "default"}
              className={cn(
                "w-full",
                !reckonConnected && "bg-reckon hover:bg-reckon/90"
              )}
            >
              {connecting === "reckon" ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : reckonConnected ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Connected
                </>
              ) : (
                "Connect Reckon"
              )}
            </Button>
          </div>
        </div>
      </div>

      {bothConnected && (
        <div className="animate-scale-in">
          <Button 
            onClick={handleStartMigration} 
            size="lg" 
            className="w-full"
            disabled={startingMigration}
          >
            {startingMigration ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting Migration...
              </>
            ) : (
              "Start Migration"
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ConnectionStep;
