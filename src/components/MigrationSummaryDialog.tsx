import { ArrowRight, BarChart3, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MigrationPreview } from "@/lib/api";

interface MigrationSummaryDialogProps {
  open: boolean;
  loading: boolean;
  preview: MigrationPreview | null;
  onCancel: () => void;
  onNext: () => void;
}

// Parse "YYYY-MM-DD" as a local date so it doesn't shift a day in negative
// UTC offsets; fall back to Date parsing for any other format.
const parseDate = (value: string): Date | null => {
  if (!value) return null;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = ymd
    ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    : new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

const formatDate = (value: string) => {
  const date = parseDate(value);
  if (!date) return value || "—";
  return date.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
};

// Australian financial years run 1 July – 30 June; count how many the range touches.
const countFinancialYears = (start: string, end: string): number | null => {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e || e < s) return null;
  const fy = (d: Date) => d.getFullYear() + (d.getMonth() >= 6 ? 1 : 0);
  return fy(e) - fy(s) + 1;
};

const Field = ({ label, value }: { label: string; value?: string }) => (
  <div className="min-w-0">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-semibold text-foreground break-words">{value || "—"}</p>
  </div>
);

const MigrationSummaryDialog = ({ open, loading, preview, onCancel, onNext }: MigrationSummaryDialogProps) => {
  const financialYears = preview ? countFinancialYears(preview.start_date, preview.end_date) : null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader className="sm:text-center">
          <DialogTitle className="text-2xl font-bold text-center">Migration Summary</DialogTitle>
          <DialogDescription className="text-center">
            Please review your migration details before proceeding
          </DialogDescription>
        </DialogHeader>

        {loading || !preview ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-1 rounded-full border border-green-500 bg-green-50 px-4 py-1 text-sm font-medium text-green-700">
                <Check className="w-4 h-4" />
                MigrationHub Verified — ID: {preview.migration_id}
              </span>
            </div>

            <section className="rounded-xl border bg-muted/40 p-5">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contact Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name" value={preview.full_name} />
                <Field label="Email" value={preview.email} />
                <Field label="Phone" value={preview.phone} />
                <Field label="Plan" value={preview.is_free ? "Free" : "Paid"} />
              </div>
            </section>

            <section className="rounded-xl border bg-muted/40 p-5">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Company Details
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Entity / Company Name" value={preview.entity_name} />
                <Field label="Financial Year End" value="30th June" />
              </div>
            </section>

            <section className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Migration Period
              </h4>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-lg border bg-white p-3 text-center">
                  <p className="text-xs uppercase text-muted-foreground">Start Date</p>
                  <p className="text-lg font-bold text-blue-900">{formatDate(preview.start_date)}</p>
                </div>
                <ArrowRight className="w-5 h-5 shrink-0 text-blue-600" />
                <div className="flex-1 rounded-lg border bg-white p-3 text-center">
                  <p className="text-xs uppercase text-muted-foreground">End Date</p>
                  <p className="text-lg font-bold text-blue-900">{formatDate(preview.end_date)}</p>
                </div>
              </div>
              {financialYears !== null && (
                <p className="mt-3 flex items-center justify-center gap-1 text-sm font-medium text-blue-700">
                  <BarChart3 className="w-4 h-4" />
                  {financialYears} financial year{financialYears === 1 ? "" : "s"} of data will be migrated
                </p>
              )}
            </section>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3 pt-2">
              <Button variant="secondary" size="lg" onClick={onCancel}>
                Cancel
              </Button>
              <Button size="lg" onClick={onNext} className="bg-blue-600 hover:bg-blue-700 text-white">
                Next — Connect Your Accounts
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MigrationSummaryDialog;
