import { useState } from "react";
import { Clock, Info, Loader2, Mail, Phone, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

const SUPPORT_EMAIL = "support@mmcconvert.com";
const SUPPORT_PHONE = "+1 (555) 123-4567";
const SUPPORT_HOURS = "Mon-Fri, 9:00 AM - 6:00 PM EST";

interface RequestHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: number | null;
}

const RequestHelpDialog = ({ open, onOpenChange, jobId }: RequestHelpDialogProps) => {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (isSending) return;
    if (!next) setMessage("");
    onOpenChange(next);
  };

  const handleSend = async () => {
    if (!jobId || !message.trim()) return;

    setIsSending(true);
    const res = await api.sendHelpRequest(jobId, message.trim());
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
    setMessage("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl p-0">
        <div className="space-y-5 p-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Request Migration Assistance</DialogTitle>
            <DialogDescription>
              Need help with your migration? Our support team is here to assist you.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="help-message" className="text-xs font-normal text-muted-foreground">
              Describe what you need help with
            </Label>
            <Textarea
              id="help-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. A few invoices seem to be missing from the migrated data..."
              className="min-h-[110px] resize-none rounded-xl"
              maxLength={5000}
              disabled={isSending}
            />
          </div>

          <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900/80">
            <p className="flex items-center gap-2 font-semibold text-indigo-700">
              <Info className="h-4 w-4" />
              What happens next?
            </p>
            <p>
              When you submit this request, our support team will be notified immediately with
              your migration details.
            </p>
            <p className="font-semibold">
              We typically respond within 2-4 hours during business hours.
            </p>
            <p>
              Our team will review your migration progress and reach out to you with personalized
              assistance.
            </p>
          </div>

          <div className="space-y-2 rounded-xl bg-muted/50 p-4 text-sm">
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">Email:</span>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 hover:underline">
                {SUPPORT_EMAIL}
              </a>
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">Phone:</span> {SUPPORT_PHONE}
            </p>
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">Hours:</span> {SUPPORT_HOURS}
            </p>
          </div>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-3 border-t p-6 pt-4 sm:space-x-0">
          <Button
            variant="outline"
            className="h-11 rounded-xl"
            onClick={() => handleOpenChange(false)}
            disabled={isSending}
          >
            Cancel
          </Button>
          <Button
            className="h-11 rounded-xl bg-amber-400 font-semibold text-white hover:bg-amber-500"
            onClick={handleSend}
            disabled={!jobId || !message.trim() || isSending}
          >
            {isSending ? <Loader2 className="animate-spin" /> : <Send />}
            {isSending ? "Sending..." : "Send Help Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RequestHelpDialog;
