import { TriangleAlert } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  tone?: "danger" | "default";
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  onCancel,
  onConfirm,
  tone = "danger",
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={tone === "danger" ? "bg-overdue/15" : ""}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-overdue/30 bg-overdue/10">
          <TriangleAlert className="size-4 text-overdue" />
        </div>
        <p className="pt-1.5 text-[13px] leading-relaxed text-ink-muted">{body}</p>
      </div>
    </Modal>
  );
}
