import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { AlertTriangle, Ban, Info } from "./Icons";
import { Button, Checkbox, Dialog } from "./ui";

export interface ConfirmRequest {
  title: string;
  eyebrow?: string;
  tone: "danger" | "warning" | "neutral";
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** When set, the user must tick a box before the action can run. */
  ack?: string;
  onConfirm: () => void;
}

export function ConfirmationDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  const [ack, setAck] = useState(false);
  useEffect(() => setAck(false), [request]);
  if (!request) return null;

  const blocked = !!request.ack && !ack;

  return (
    <Dialog
      open
      onClose={onClose}
      title={request.title}
      eyebrow={request.eyebrow}
      tone={request.tone === "neutral" ? "neutral" : request.tone}
      icon={
        request.tone === "danger" ? (
          <Ban className="h-4 w-4" />
        ) : request.tone === "warning" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <Info className="h-4 w-4" />
        )
      }
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            {request.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={request.tone === "danger" ? "danger" : "primary"}
            size="md"
            disabled={blocked}
            onClick={() => {
              request.onConfirm();
              onClose();
            }}
          >
            {request.confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-[13px] leading-relaxed text-u-ink2">{request.body}</div>
      {request.ack && (
        <div
          className={cn(
            "mt-4 rounded-[7px] border px-3 py-2.5 transition-colors",
            ack ? "border-u-ok/30 bg-u-ok-soft/60" : "border-u-line bg-u-s2",
          )}
        >
          <Checkbox id="confirm-ack" checked={ack} onChange={setAck} label={request.ack} />
        </div>
      )}
    </Dialog>
  );
}
