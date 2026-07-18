import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Check, Link2, Loader2, ArrowRight, Wifi, Building2, Plus, ChevronLeft, Lock, Shield, CreditCard, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import mmcLogo from "@/asset/mmc_logo.png";
import xeroLogo from "@/asset/xero-logo.png";
import reckonLogo from "@/asset/reckonone-logo.png";

const PLATFORM_LOGOS: Record<string, string> = {
  XE: xeroLogo,
  RK: reckonLogo,
};

interface ConnectionStepProps {
  onComplete: () => void;
  fileId?: number | null;
  onToolIdsSet?: (xeroId: number, reckonId: number) => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Pairs whose backend "source connect" route creates the Job itself
// (e.g. source_qboconnect for "qbo-myob") when hit without a valid job yet —
// the frontend must not block Connect just because localStorage has no jobId.
const AUTO_CREATE_JOB_PAIRS = new Set(["qbo-myob","xero-reckon","myob-qbo"]);


const PAIR_URLS: Record<string, { source: string; dest: string }> = {
  "qbo-xero":    { source: "source_qboconnect",    dest: "source_xeroconnect" },
  "xero-myob":   { source: "source_xeroconnect",   dest: "myob_connect" },
  "myob-qbo":    { source: "myob_connect",    dest: "source_qboconnect" },
  "qbo-myob":    { source: "source_qboconnect",    dest: "myob_connect" },
  "xero-qbo":    { source: "source_xeroconnect",    dest: "source_qboconnect" },
  "xero-reckon": { source: "source_xeroconnect", dest: "destination_reckonone" },
  "xero-prosaic":{ source: "source_xeroconnect", dest: "prosaic_callback" },
};

// Upstream link generators sometimes mint URLs with a stray extra "?" instead of "&"
// (e.g. "?pair=qbo-myob?migrationId=123&journeyStep=6"). URLSearchParams only splits on
// "&", so that "?" would otherwise get swallowed into the "pair" value and break lookups.
// Normalize any "?" after the first into "&" before parsing.
const sanitizeSearch = (search: string) => {
  if (!search) return search;
  const [first, ...rest] = search.split("?");
  return rest.length ? `${first}?${rest.join("&")}` : search;
};

const PAIRS_LOOKUP: Record<string, { id: string; sourceCode: string; sourceLabel: string; sourceBg: string; destCode: string; destLabel: string; destBg: string }> = {
  "myob-qbo":    { id: "myob-qbo",    sourceCode: "MY", sourceLabel: "MYOB",  sourceBg: "bg-red-800",   destCode: "QB", destLabel: "QBO",     destBg: "bg-green-700" },
  "qbo-myob":    { id: "qbo-myob",    sourceCode: "QB", sourceLabel: "QBO",   sourceBg: "bg-green-700", destCode: "MY", destLabel: "MYOB",    destBg: "bg-red-800"   },
  "xero-myob":   { id: "xero-myob",   sourceCode: "XE", sourceLabel: "Xero",  sourceBg: "bg-cyan-500",  destCode: "MY", destLabel: "MYOB",    destBg: "bg-red-800"   },
  "xero-prosaic":{ id: "xero-prosaic",sourceCode: "XE", sourceLabel: "Xero",  sourceBg: "bg-cyan-500",  destCode: "PR", destLabel: "Prosaic", destBg: "bg-purple-600"},
  "xero-qbo":    { id: "xero-qbo",    sourceCode: "XE", sourceLabel: "Xero",  sourceBg: "bg-cyan-500",  destCode: "QB", destLabel: "QBO",     destBg: "bg-green-700" },
  "xero-reckon": { id: "xero-reckon", sourceCode: "XE", sourceLabel: "Xero",  sourceBg: "bg-cyan-500",  destCode: "RK", destLabel: "Reckon",  destBg: "bg-teal-800"  },
  "qbo-xero":    { id: "qbo-xero",    sourceCode: "QB", sourceLabel: "QBO",   sourceBg: "bg-green-700", destCode: "XE", destLabel: "Xero",    destBg: "bg-cyan-500"  },
};

const ConnectionStep = ({ onComplete, fileId, onToolIdsSet }: ConnectionStepProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  // pair resolution:
  // 1. URL ?pair= param (highest priority — also covers post-OAuth redirects)
  // 2. Router state with full data (navigate from MigrationPairs)
  // 3. Router state with only { id } (navigate from CustomerInfoForm via URL) → resolve via PAIRS_LOOKUP
  // 4. localStorage (OAuth redirect strips the URL, so persisted pair is used)
  const pair = (() => {
    const qp = new URLSearchParams(sanitizeSearch(location.search)).get("pair");
    if (qp && PAIRS_LOOKUP[qp]) return PAIRS_LOOKUP[qp];

    const statePair = location.state?.pair;
    if (statePair?.sourceCode) return statePair;           // full pair from state
    if (statePair?.id && PAIRS_LOOKUP[statePair.id]) return PAIRS_LOOKUP[statePair.id]; // partial { id } → resolve

    try {
      const stored = localStorage.getItem("pendingPairData");
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  })();

  // migrationId resolution mirrors `pair`: URL takes priority (fresh hit from the
  // onboarding link), falling back to what was persisted from an earlier hit on this
  // page — needed because handleConnect's redirect to source_qboconnect happens after
  // the initial navigation, and the backend route reads it via request.args.get("migrationId").
  const migrationId = (() => {
    const qp = new URLSearchParams(sanitizeSearch(location.search)).get("migrationId");
    return qp ?? localStorage.getItem("pendingMigrationId");
  })();

  const sourceCode  = pair?.sourceCode  ?? "XE";
  const sourceBg    = pair?.sourceBg    ?? "bg-blue-500";
  const sourceLabel = pair?.sourceLabel ?? "Xero";
  const destCode    = pair?.destCode    ?? "RK";
  const destBg      = pair?.destBg      ?? "bg-orange-500";
  const destLabel   = pair?.destLabel   ?? "Prosaic";

  const [xeroConnected, setXeroConnected] = useState(false);
  const [reckonConnected, setReckonConnected] = useState(false);
  const [connecting, setConnecting] = useState<"xero" | "reckon" | null>(null);
  const [startingMigration, setStartingMigration] = useState(false);
  const [xeroToolId, setXeroToolId] = useState<number | null>(null);
  const [reckonToolId, setReckonToolId] = useState<number | null>(null);

  useEffect(() => {
    const qp = new URLSearchParams(sanitizeSearch(location.search));
    const isOAuthReturn = qp.has("code") || qp.has("source_connected") || qp.has("dest_connected")
      || qp.has("xero_connected") || qp.has("xero_myobconnected") || qp.has("prosaic_connected") || qp.has("error");
    const navigatedInternally = Boolean(location.state?.pair);

    if (qp.has("pair") && !isOAuthReturn && !navigatedInternally) {
      const prevJobId = localStorage.getItem("jobId");
      if (prevJobId) {
        localStorage.removeItem(`sourceConnected_${prevJobId}`);
        localStorage.removeItem(`destConnected_${prevJobId}`);
      }
      localStorage.removeItem("jobId");
      localStorage.removeItem("pendingPairId");
      localStorage.removeItem("pendingPairData");
      localStorage.removeItem("pendingService");

      const migrationIdParam = qp.get("migrationId");
      if (migrationIdParam) {
        localStorage.setItem("pendingMigrationId", migrationIdParam);
      } else {
        localStorage.removeItem("pendingMigrationId");
      }
    }
  }, []);

  // Restore persisted auth state for this job on mount (survives page reload)
  useEffect(() => {
    const storedJobId = localStorage.getItem("jobId");
    if (!storedJobId) return;
    if (localStorage.getItem(`sourceConnected_${storedJobId}`) === "true") {
      setXeroConnected(true);
    }
    if (localStorage.getItem(`destConnected_${storedJobId}`) === "true") {
      setReckonConnected(true);
    }
  }, []);

  const handleStartMigration = async () => {

  console.log("Start Migration clicked");

  const storedJobId = localStorage.getItem("jobId");
  console.log("Stored Job ID:", storedJobId);

  if (!storedJobId) {
    toast({
      title: "Missing Job",
      description: "Job ID not found. Please complete the customer info step first.",
      variant: "destructive",
    });
    return;
  }

  const jobId = Number(storedJobId);

  setStartingMigration(true);

  navigate(`/migration-progress/${jobId}`);

  try {

    console.log("Calling API with Job ID:", jobId);

    const response = await api.startMigration(jobId);

    console.log("API Response:", response);

    if (!response.data?.redirect_url) {
      toast({
        title: "Migration Started",
        description: `Migration started for job ID: ${jobId}`,
      });


    }

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

  useEffect(() => {
    const urlParams = new URLSearchParams(sanitizeSearch(window.location.search));
    const code = urlParams.get("code");
    const hasErrorParam = urlParams.has("error");

    // Generic params (recommended — works for all migration pairs)
    const sourceConnectedParam = urlParams.get("source_connected");
    const destConnectedParam   = urlParams.get("dest_connected");

    // Legacy pair-specific params (backward compat)
    const xeroConnectedParam   = urlParams.get("xero_connected") ?? urlParams.get("xero_myobconnected");
    const reckonConnectedParam = urlParams.get("prosaic_connected");

    const isSourceCallback = (sourceConnectedParam && sourceConnectedParam !== "false" && sourceConnectedParam !== "0")
      || (xeroConnectedParam && xeroConnectedParam !== "false" && xeroConnectedParam !== "0");

    const isDestCallback = (destConnectedParam && destConnectedParam !== "false" && destConnectedParam !== "0")
      || (reckonConnectedParam && reckonConnectedParam !== "false" && reckonConnectedParam !== "0");

    // When a backend auto-create route (e.g. source_qboconnect for qbo-myob) minted a
    // real Job for a dummy jobId, it should hand the real id back on redirect so we
    // stop using the dummy for the rest of the flow (destination connect, start migration).
    const returnedJobId = urlParams.get("job_id") ?? urlParams.get("jobId");
    if (returnedJobId) {
      localStorage.setItem("jobId", returnedJobId);
    }

    const persistSourceAuth = () => {
      const storedJobId = localStorage.getItem("jobId");
      if (storedJobId) localStorage.setItem(`sourceConnected_${storedJobId}`, "true");
    };

    const persistDestAuth = () => {
      const storedJobId = localStorage.getItem("jobId");
      if (storedJobId) {
        localStorage.setItem(`sourceConnected_${storedJobId}`, "true");
        localStorage.setItem(`destConnected_${storedJobId}`, "true");
      }
    };

    // Source connected callback
    if (isSourceCallback) {
      setXeroConnected(true);
      persistSourceAuth();
      localStorage.removeItem("pendingPairId");
      localStorage.removeItem("pendingService");
      toast({ title: `${pair?.sourceLabel ?? "Source"} Connected`, description: `Successfully connected to your ${pair?.sourceLabel ?? "source"} account.` });
      window.history.replaceState({}, document.title, window.location.pathname);
      const storedJobId = localStorage.getItem("jobId");
      if (storedJobId) {
        fetch(`${API_BASE_URL}/source_xeroconnect/${storedJobId}`, { method: "GET" }).catch(console.error);
      }
      return;
    }

    // Destination connected callback
    if (isDestCallback) {
      setXeroConnected(true);
      setReckonConnected(true);
      persistDestAuth();
      localStorage.removeItem("pendingPairId");
      localStorage.removeItem("pendingService");
      toast({ title: `${pair?.destLabel ?? "Destination"} Connected`, description: `Successfully connected to your ${pair?.destLabel ?? "destination"} account.` });
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // OAuth2 code flow — use pendingService to identify which service completed
    if (code && !hasErrorParam) {
      const pendingService = localStorage.getItem("pendingService");
      const isSourceByCode = pendingService === "xero"
        || window.location.pathname.includes("create_auth_code")
        || window.location.search.includes("xero");
      const isDestByCode = pendingService === "reckon"
        || window.location.pathname.includes("reckon_callback")
        || window.location.search.includes("reckon");

      if (isSourceByCode) {
        setXeroConnected(true);
        persistSourceAuth();
        toast({ title: `${pair?.sourceLabel ?? "Source"} Connected`, description: `Successfully connected to your ${pair?.sourceLabel ?? "source"} account.` });
      } else if (isDestByCode) {
        setXeroConnected(true);
        setReckonConnected(true);
        persistDestAuth();
        toast({ title: `${pair?.destLabel ?? "Destination"} Connected`, description: `Successfully connected to your ${pair?.destLabel ?? "destination"} account.` });
      }
      localStorage.removeItem("pendingPairId");
      localStorage.removeItem("pendingService");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleConnect = async (service: "xero" | "reckon") => {
    setConnecting(service);

    try {
      const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const storedJobId = localStorage.getItem("jobId");
      const currentPairId = pair?.id ?? "xero-prosaic";

      // For pairs whose backend auto-creates the Job on connect (e.g. qbo-myob's
      // source_qboconnect route), a missing jobId isn't an error — fall back to a
      // dummy id and let the backend route create and return the real one.
      const backendCreatesJob = service === "xero" && AUTO_CREATE_JOB_PAIRS.has(currentPairId);

      if (!storedJobId && !backendCreatesJob) {
        toast({
          title: "Missing Job",
          description: "Job ID not found. Please complete the customer info step first.",
          variant: "destructive",
        });
        setConnecting(null);
        return;
      }

      const jobId = storedJobId ? Number(storedJobId) : 0;

      const urls = PAIR_URLS[currentPairId] ?? PAIR_URLS["xero-prosaic"];

      // Save pair ID, service, and full pair data so the OAuth callback can restore correct context
      localStorage.setItem("pendingPairId", currentPairId);
      localStorage.setItem("pendingService", service);
      if (pair) {
        localStorage.setItem("pendingPairData", JSON.stringify(pair));
      }

      if (service === "xero") {
        setXeroToolId(jobId);
        const migrationIdParam = migrationId ? `&migrationId=${encodeURIComponent(migrationId)}` : "";
        window.location.href = `${base}/${urls.source}/${jobId}?pair_id=${currentPairId}${migrationIdParam}`;
      } else {
        setReckonToolId(jobId);
        window.location.href = `${base}/${urls.dest}/${jobId}?pair_id=${currentPairId}`;
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

  useEffect(() => {
    if (xeroToolId && reckonToolId && onToolIdsSet) {
      onToolIdsSet(xeroToolId, reckonToolId);
    }
  }, [xeroToolId, reckonToolId, onToolIdsSet]);

  const handleExistingEntity = () => {
    const storedJobId = localStorage.getItem("jobId");
    if (!storedJobId) {
      toast({
        title: "Missing Job",
        description: "Job ID not found. Please complete the customer info step first.",
        variant: "destructive",
      });
      return;
    }
    navigate(`/prosaic-file-selection/${storedJobId}`);
  };

  const handleCreateNewEntity = () => {
    handleConnect("reckon");
  };

  const bothConnected = xeroConnected && reckonConnected;

  return (
    <div className="min-h-screen bg-[#f4f6fb] flex flex-col font-sans text-gray-900">

      {/* Top header bar */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate("/migration-pairs")}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          All migration pairs
        </button>
        <img src={mmcLogo} alt="MMC Convert" className="h-8 w-auto" />
        <button className="text-sm border border-gray-300 rounded-md px-4 py-1.5 text-gray-700 hover:bg-gray-50 transition-colors">
          Save &amp; exit
        </button>
      </header>

      {/* Breadcrumb */}
      <div className="px-8 pt-5 pb-1">
        <p className="text-xs text-gray-400">
          MMC Convert&nbsp;/&nbsp;Migration Pairs&nbsp;/&nbsp;{sourceLabel} to {destLabel}
        </p>
      </div>

      {/* Pair info card */}
      <div className="px-8 py-3">
        <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {PLATFORM_LOGOS[sourceCode] ? (
                <img src={PLATFORM_LOGOS[sourceCode]} alt={sourceLabel} className="w-10 h-10 rounded-lg object-contain bg-white p-1 shadow" />
              ) : (
                <div className={`w-10 h-10 rounded-lg ${sourceBg} flex items-center justify-center text-white font-bold text-sm shadow`}>{sourceCode}</div>
              )}
              <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              {PLATFORM_LOGOS[destCode] ? (
                <img src={PLATFORM_LOGOS[destCode]} alt={destLabel} className="w-10 h-10 rounded-lg object-contain bg-white p-1 shadow" />
              ) : (
                <div className={`w-10 h-10 rounded-lg ${destBg} flex items-center justify-center text-white font-bold text-sm shadow`}>{destCode}</div>
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900">{sourceLabel} → {destLabel} Migration</h1>
              <p className="text-xs text-gray-500 mt-0.5">Enterprise accounting data migration · Powered by MMC Convert</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <InfoBadge icon={<Lock className="w-3 h-3" />} label="Read-only source" />
            <InfoBadge icon={<Shield className="w-3 h-3" />} label="SSL encrypted" color="blue" />
            <InfoBadge icon={<CreditCard className="w-3 h-3" />} label="Payment verified" color="green" />
            <InfoBadge icon={<History className="w-3 h-3" />} label="Full history included" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-8 py-6">
        <div className="w-full max-w-2xl space-y-4">

          {/* Section header */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Wifi className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Connect Your Accounts</h2>
              <p className="text-xs text-gray-500">Link both platforms to enable secure data migration</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="bg-white border border-gray-200 rounded-2xl px-6 py-4 shadow-sm">
            <div className="flex items-center gap-2">
              <StepDot active={true} done={xeroConnected} label={`Connect ${sourceLabel}`} />
              <div className={cn("flex-1 h-0.5 rounded-full transition-colors duration-500", xeroConnected ? "bg-blue-500" : "bg-gray-200")} />
              <StepDot active={xeroConnected} done={reckonConnected} label={`Connect ${destLabel}`} />
              <div className={cn("flex-1 h-0.5 rounded-full transition-colors duration-500", reckonConnected ? "bg-blue-500" : "bg-gray-200")} />
              <StepDot active={reckonConnected} done={bothConnected && startingMigration} label="Start Migration" />
            </div>
          </div>

          {/* Connection cards */}
          <div className="grid md:grid-cols-2 gap-4">
            <ConnectionCard
              connected={xeroConnected}
              connecting={connecting === "xero"}
              disabled={xeroConnected || connecting === "xero"}
              accentColor="blue"
              logo={<PlatformBadge code={sourceCode} bg={sourceBg} logo={PLATFORM_LOGOS[sourceCode]} />}
              name={sourceLabel}
              description="Source accounting platform"
              buttonLabel={`Connect ${sourceLabel}`}
              onConnect={() => handleConnect("xero")}
            />
            <ConnectionCard
              connected={reckonConnected}
              connecting={connecting === "reckon"}
              disabled={!xeroConnected || reckonConnected || connecting === "reckon"}
              accentColor="orange"
              logo={<PlatformBadge code={destCode} bg={destBg} logo={PLATFORM_LOGOS[destCode]} />}
              name={destLabel}
              description="Destination accounting platform"
              buttonLabel={`Connect ${destLabel}`}
              onConnect={() => handleConnect("reckon")}
              locked={!xeroConnected}
              lockedLabel={`Connect ${sourceLabel} first`}
            />
          </div>

          {/* Start Migration CTA */}
          {bothConnected && (
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleStartMigration}
                size="lg"
                className="w-full text-base py-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg group transition-all duration-300"
                disabled={startingMigration}
              >
                {startingMigration ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Preparing your mapping data...
                  </>
                ) : (
                  <>
                    Start Migration
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>

              {startingMigration && (
                <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex flex-col gap-3 shadow-sm">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest">Setting up your migration</p>
                  {[
                    `Fetching Chart of Accounts from ${sourceLabel}`,
                    `Reading ${destLabel} account structure`,
                    "Running AI mapping engine",
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" style={{ animationDelay: `${i * 0.3}s` }} />
                      <span className="text-gray-600 text-sm">{step}</span>
                    </div>
                  ))}
                  <p className="text-gray-400 text-xs mt-1">This may take a few seconds — please don't close this page.</p>
                </div>
              )}
            </div>
          )}

          <p className="text-center text-gray-400 text-xs">Step 2 of 3 &mdash; Connect Accounts</p>
        </div>
      </div>
    </div>
  );
};

/* ── Sub-components ─────────────────────────────────────────── */

interface ConnectionCardProps {
  connected: boolean;
  connecting: boolean;
  disabled: boolean;
  accentColor: "blue" | "orange";
  logo: React.ReactNode;
  name: string;
  description: string;
  buttonLabel: string;
  onConnect: () => void;
  locked?: boolean;
  lockedLabel?: string;
}

const ConnectionCard = ({
  connected,
  connecting,
  disabled,
  accentColor,
  logo,
  name,
  description,
  buttonLabel,
  onConnect,
  locked = false,
  lockedLabel = "Connect source first",
}: ConnectionCardProps) => {
  const accent = accentColor === "blue"
    ? { border: "border-blue-200", activeBorder: "border-blue-400", bg: "bg-blue-50", dot: "bg-blue-500", badge: "bg-blue-50 text-blue-600 border-blue-200", btn: "bg-blue-600 hover:bg-blue-700" }
    : { border: "border-orange-200", activeBorder: "border-orange-400", bg: "bg-orange-50", dot: "bg-orange-500", badge: "bg-orange-50 text-orange-600 border-orange-200", btn: "bg-orange-500 hover:bg-orange-600" };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center text-center gap-5 p-6 rounded-2xl border bg-white shadow-sm transition-all duration-300",
        connected
          ? `${accent.activeBorder} ${accent.bg}`
          : locked
          ? "border-gray-100 opacity-60"
          : `border-gray-200 hover:${accent.border} hover:shadow-md`
      )}
    >
      {/* Connected badge */}
      {connected && (
        <div className={cn("absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium", accent.badge)}>
          <Check className="w-3 h-3" />
          Connected
        </div>
      )}

      {/* Logo */}
      <div className="relative mt-2">
        <div className={cn(
          "p-3 rounded-2xl border transition-all duration-300",
          connected ? `${accent.bg} ${accent.activeBorder}` : "bg-gray-50 border-gray-200"
        )}>
          {logo}
        </div>
        {connected && (
          <div className={cn("absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow", accent.dot)}>
            <Link2 className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Text */}
      <div>
        <h3 className="text-base font-semibold text-gray-900">{name}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>

      {/* Button */}
      <Button
        onClick={onConnect}
        disabled={connected || disabled}
        className={cn(
          "w-full rounded-xl border-0 transition-all duration-300",
          connected
            ? "bg-gray-100 text-gray-400 cursor-default"
            : locked
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : `${accent.btn} text-white shadow`
        )}
      >
        {connecting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Connecting...
          </>
        ) : connected ? (
          <>
            <Check className="w-4 h-4 mr-2" />
            Connected
          </>
        ) : locked ? (
          lockedLabel
        ) : (
          buttonLabel
        )}
      </Button>
    </div>
  );
};

interface ProsaicChoiceCardProps {
  connected: boolean;
  locked: boolean;
  connecting: boolean;
  onExistingEntity: () => void;
  onCreateNew: () => void;
  logo?: React.ReactNode;
  name?: string;
}

const ProsaicChoiceCard = ({ connected, locked, connecting, onExistingEntity, onCreateNew, logo, name = "Prosaic" }: ProsaicChoiceCardProps) => {
  const accent = {
    border: "border-orange-500/50",
    glow: "shadow-orange-900/30",
    bg: "bg-orange-500/10",
    dot: "bg-orange-500",
    badge: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  };

  return (
    <div className={cn(
      "relative flex flex-col items-center text-center gap-5 p-6 rounded-2xl border transition-all duration-300",
      connected
        ? `${accent.border} ${accent.bg} shadow-xl ${accent.glow}`
        : locked
        ? "border-white/5 bg-white/3 opacity-50"
        : "border-white/10 bg-white/5 hover:border-white/20"
    )}>
      {connected && (
        <div className={cn("absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium", accent.badge)}>
          <Check className="w-3 h-3" />
          Connected
        </div>
      )}

      <div className="relative mt-2">
        <div className={cn(
          "p-3 rounded-2xl border transition-all duration-300",
          connected ? `${accent.bg} ${accent.border}` : "bg-white/5 border-white/10"
        )}>
          {logo ?? <PlatformBadge code="RK" bg="bg-orange-500" />}
        </div>
        {connected && (
          <div className={cn("absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2 border-slate-900", accent.dot)}>
            <Link2 className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-white">{name}</h3>
        <p className="text-xs text-white/40 mt-0.5">Destination accounting platform</p>
      </div>

      {connected ? (
        <Button disabled className="w-full rounded-xl border-0 bg-white/10 text-white/50 cursor-default">
          <Check className="w-4 h-4 mr-2" />
          Connected
        </Button>
      ) : locked ? (
        <Button disabled className="w-full rounded-xl border-0 bg-white/5 text-white/30 cursor-not-allowed">
          Connect source first
        </Button>
      ) : (
        <div className="w-full space-y-2.5">
          <Button
            onClick={onExistingEntity}
            disabled={connecting}
            className="w-full rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 shadow-none transition-all duration-200"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Existing Entity
          </Button>
          <Button
            onClick={onCreateNew}
            disabled={connecting}
            className="w-full rounded-xl border-0 bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/40 transition-all duration-200"
          >
            {connecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Create New Entity
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

const InfoBadge = ({ icon, label, color }: { icon: React.ReactNode; label: string; color?: "blue" | "green" }) => {
  const styles = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full px-2.5 py-0.5 text-xs font-medium ${color ? styles[color] : "bg-gray-100 text-gray-500 border-gray-200"}`}>
      {icon}{label}
    </span>
  );
};

const PlatformBadge = ({ code, bg, logo }: { code: string; bg: string; logo?: string }) =>
  logo ? (
    <img src={logo} alt={code} className="w-16 h-16 rounded-2xl object-contain bg-white p-2 shadow-lg" />
  ) : (
    <div className={`w-16 h-16 rounded-2xl ${bg} flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
      {code}
    </div>
  );

const StepDot = ({ active, done, label }: { active: boolean; done: boolean; label: string }) => (
  <div className="flex flex-col items-center gap-1 min-w-[60px]">
    <div className={cn(
      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-500",
      done ? "bg-blue-500 border-blue-500" : active ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-white"
    )}>
      {done && <Check className="w-3 h-3 text-white" />}
    </div>
    <span className="text-[10px] text-gray-400 whitespace-nowrap">{label}</span>
  </div>
);

export default ConnectionStep;