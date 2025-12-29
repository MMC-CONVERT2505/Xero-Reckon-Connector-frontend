import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, MigrationListItem } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Eye, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const statusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    case "in-progress":
      return "bg-blue-100 text-blue-800";
    case "error":
      return "bg-red-100 text-red-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [migrations, setMigrations] = useState<MigrationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPolling, setIsPolling] = useState(true);

  const loadMigrations = async () => {
    try {
      const res = await api.getAllMigrations();
      
      if (res.error) {
        setError(res.error.message || "Failed to load migrations");
        toast({
          title: "Error",
          description: res.error.message || "Failed to load migrations",
          variant: "destructive",
        });
      } else if (res.data) {
        setMigrations(res.data);
        setError(null);
        setLastUpdated(new Date());
      }
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load migrations");
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;

    // Initial load
    setLoading(true);
    loadMigrations();

    // Poll every 2 seconds if polling is enabled
    if (isPolling) {
      interval = window.setInterval(() => {
        if (!cancelled) {
          loadMigrations();
        }
      }, 2000);
    }

    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [isPolling]);

  const handleRefresh = () => {
    setLoading(true);
    loadMigrations();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
              {isPolling && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Wifi className="w-4 h-4 text-green-500 animate-pulse" />
                  <span>Live</span>
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Overview of all migration jobs. Updates every 2 seconds.
            </p>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground mt-1">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
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
          </div>
        </header>

        {loading && migrations.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Total Records</TableHead>
                  <TableHead>Records Migrated</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {migrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No migrations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  migrations.map((m) => (
                    <TableRow key={m.job_id} className="transition-colors">
                      <TableCell className="font-medium">#{m.job_id}</TableCell>
                      <TableCell>
                        <Badge className={statusColor(m.status)}>{m.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <span className="text-sm font-medium">{Math.round(m.progress ?? 0)}%</span>
                          <Progress value={m.progress ?? 0} className="h-2 flex-1" />
                        </div>
                      </TableCell>
                      <TableCell>{m.total_records?.toLocaleString() ?? "-"}</TableCell>
                      <TableCell className="text-primary font-medium">
                        {m.records_migrated?.toLocaleString() ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.updated_at ? new Date(m.updated_at).toLocaleString() : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/migrations/${m.job_id}`)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;