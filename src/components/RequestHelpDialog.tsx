import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

const SUPPORT_EMAIL = "reckon@mmcconvert.com";
const SUPPORT_PHONE = "+919926477000";


interface RequestHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: number | null;
}

const RequestHelpDialog = ({ open, onOpenChange, jobId }: RequestHelpDialogProps) => {
  const [isSending, setIsSending] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (isSending) return;
    onOpenChange(next);
  };

  const handleSend = async () => {
    if (!jobId) return;

    setIsSending(true);
    const res = await api.sendHelpRequest(jobId);
    setIsSending(false);

    if (res.error) {
      toast({
        title: "Couldn't send request",
        description: res.error.message || "Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Help request sent",
      description: "Our support team has been notified and will reach out to you shortly.",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-lg gap-5 rounded-2xl sm:rounded-2xl"
        overlayClassName="bg-black/40 backdrop-blur-sm"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Request Migration Assistance</DialogTitle>
        </DialogHeader>

        <DialogDescription className="rounded-xl border border-blue-300 bg-blue-50 p-4 text-blue-900">
          Our team will review your migration progress and reach out to you with personalized
          assistance.
        </DialogDescription>

        <div className="space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
          <p>
            <span className="mr-3 font-semibold">Email:</span>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p>
            <span className="mr-3 font-semibold">Phone:</span>
            <span className="text-muted-foreground">{SUPPORT_PHONE}</span>
          </p>
        </div>

        <DialogFooter className="gap-3 pt-2 sm:space-x-0">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => handleOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl bg-amber-400 font-bold text-foreground hover:bg-amber-500"
            onClick={handleSend}
            disabled={!jobId || isSending}
          >
            {isSending && <Loader2 className="animate-spin" />}
            {isSending ? "Sending..." : "Send Help Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RequestHelpDialog;
