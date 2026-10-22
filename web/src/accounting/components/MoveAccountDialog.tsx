import { useEffect, useMemo, useState } from "react";
import { useChart } from "../store/chart-store";
import { ancestorChain, childrenOf, childrenMap } from "../coa/tree";
import { validateMove } from "../coa/validation";
import type { InsertPosition } from "../coa/types";
import { cn } from "../utils/cn";
import { ParentAccountSelector } from "./ParentAccountSelector";
import { Button, Checkbox, Dialog, Field, Note, Select } from "./ui";
import { AlertTriangle, CornerDownRight, MoveIcon } from "./Icons";

export interface MoveRequest {
  id: string;
  position?: InsertPosition;
}

export function MoveAccountDialog({
  request,
  onClose,
}: {
  request: MoveRequest | null;
  onClose: () => void;
}) {
  const { state, api } = useChart();
  const account = request ? state.accounts.find((a) => a.id === request.id) ?? null : null;

  const [parentId, setParentId] = useState<string | null>(null);
  const [placement, setPlacement] = useState<string>("end");
  const [ack, setAck] = useState(false);

  useEffect(() => {
    if (!account) return;
    setParentId(account.parentId);
    setPlacement("end");
    setAck(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  const childMap = useMemo(() => childrenMap(state.accounts), [state.accounts]);

  const siblings = useMemo(
    () => childrenOf(childMap, parentId).filter((s) => s.id !== account?.id),
    [childMap, parentId, account?.id],
  );

  const check = useMemo(
    () => (account ? validateMove(state.accounts, account.id, parentId) : null),
    [state.accounts, account, parentId],
  );

  if (!request || !account || !check) return null;

  const currentChain = ancestorChain(state.accounts, account.id);
  const proposedChain = parentId
    ? ancestorChain(state.accounts, parentId)
    : [];
  const reParenting = parentId !== account.parentId;

  const position: InsertPosition = (() => {
    if (placement.startsWith("before:") || placement.startsWith("after:")) {
      const [kind, siblingId] = [placement.split(":")[0], placement.split(":")[1]] as [
        "before" | "after",
        string,
      ];
      return { kind, siblingId };
    }
    if (placement === "start" && siblings.length) return { kind: "before", siblingId: siblings[0].id };
    if (parentId) return { kind: "child", parentId };
    return { kind: "root" };
  })();

  const commit = () => {
    api.moveAccountTo(account.id, position);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      eyebrow={`Move · ${account.code}`}
      title="Move account to a new position"
      icon={<MoveIcon className="h-4 w-4" />}
      tone={check.errors.length ? "danger" : "warning"}
      width="max-w-[620px]"
      footer={
        <>
          <span className="mr-auto text-[11.5px] text-u-muted">
            {check.descendants > 0
              ? `${check.descendants} descendant account${check.descendants === 1 ? "" : "s"} move with it`
              : "No descendants — only this account moves"}
          </span>
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={!check.ok || (reParenting && !ack)}
            onClick={commit}
          >
            Confirm move
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* current vs proposed */}
        <div className="grid gap-2.5 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
          <div className="rounded-[8px] border border-u-line bg-u-s2 px-3 py-2.5">
            <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-u-muted">
              Current position
            </p>
            <p className="flex flex-wrap items-center gap-x-1 text-[12px] leading-snug text-u-ink2">
              {currentChain.map((node, i) => (
                <span key={node.id} className="flex items-center gap-1">
                  {i > 0 && <span className="text-u-muted">›</span>}
                  <span className={cn("font-mono tabular", i === currentChain.length - 1 ? "text-u-ink" : "text-u-muted")}>
                    {node.code}
                  </span>
                </span>
              ))}
            </p>
            <p className="mt-1 truncate text-[12.5px] font-medium text-u-ink">
              {account.parentId ? currentChain[currentChain.length - 2]?.name ?? "" : "Top level of the chart"}
            </p>
          </div>

          <div className="flex items-center justify-center text-u-muted sm:rotate-0 rotate-90">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12h15M14 7l5 5-5 5" />
            </svg>
          </div>

          <div
            className={cn(
              "rounded-[8px] border px-3 py-2.5 transition-colors",
              reParenting ? "border-u-accent/35 bg-u-accent-soft/60" : "border-u-line bg-u-s2",
            )}
          >
            <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-u-muted">
              Proposed position
            </p>
            <p className="flex flex-wrap items-center gap-x-1 text-[12px] leading-snug text-u-ink2">
              {proposedChain.length === 0 && <span className="text-u-muted">Top level</span>}
              {proposedChain.map((node, i) => (
                <span key={node.id} className="flex items-center gap-1">
                  {i > 0 && <span className="text-u-muted">›</span>}
                  <span className="font-mono text-u-ink tabular">{node.code}</span>
                </span>
              ))}
            </p>
            <p className="mt-1 truncate text-[12.5px] font-medium text-u-ink">
              {parentId ? proposedChain[proposedChain.length - 1]?.name ?? "" : "No parent — root-level account"}
            </p>
          </div>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label="New parent account" htmlFor="move-parent" hint="Only valid destinations are selectable.">
            <ParentAccountSelector
              id="move-parent"
              accounts={state.accounts}
              value={parentId}
              type={account.type}
              editingId={account.id}
              onChange={(id) => {
                setParentId(id);
                setPlacement("end");
              }}
              invalid={check.errors.length > 0}
            />
          </Field>

          <Field label="Placement among siblings" htmlFor="move-placement">
            <Select
              id="move-placement"
              value={placement}
              onChange={(e) => setPlacement(e.target.value)}
            >
              <option value="end">Last child</option>
              <option value="start">First child</option>
              {siblings.map((s) => (
                <option key={`before:${s.id}`} value={`before:${s.id}`}>
                  Before {s.code} {s.name}
                </option>
              ))}
              {siblings.map((s) => (
                <option key={`after:${s.id}`} value={`after:${s.id}`}>
                  After {s.code} {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="rounded-[8px] border border-u-line bg-u-card px-3 py-2.5">
          <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-u-muted">
            Destination path preview
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-u-ink2">
            <span className="uppercase tracking-[0.06em] text-u-muted">Chart</span>
            {proposedChain.map((node) => (
              <span key={node.id} className="flex items-center gap-1.5">
                <span className="text-u-muted">›</span>
                <span className="font-mono text-[11.5px]">{node.code}</span>
                <span className="max-w-[16ch] truncate">{node.name}</span>
              </span>
            ))}
            <span className="text-u-muted">›</span>
            <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-u-accent/30 bg-u-accent-soft px-1.5 py-0.5 font-medium text-u-accent">
              <CornerDownRight className="h-3 w-3" />
              <span className="font-mono text-[11.5px] tabular">{account.code}</span>
              {account.name}
            </span>
          </p>
        </div>

        {check.errors.length > 0 && (
          <Note tone="danger" title="This move is not allowed" icon={<AlertTriangle className="h-4 w-4" />}>
            <ul className="list-disc space-y-1 pl-4">
              {check.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Note>
        )}

        {check.errors.length === 0 && check.warnings.length > 0 && (
          <Note tone="warning" title="Before you commit" icon={<AlertTriangle className="h-4 w-4" />}>
            <ul className="list-disc space-y-1 pl-4">
              {check.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Note>
        )}

        {reParenting && (
          <div
            className={cn(
              "rounded-[7px] border px-3 py-2.5 transition-colors",
              ack ? "border-u-ok/30 bg-u-ok-soft/60" : "border-u-line bg-u-s2",
            )}
          >
            <Checkbox
              id="move-ack"
              checked={ack}
              onChange={setAck}
              label="I understand this changes the account’s grouping in financial reports and any connected integrations."
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}
