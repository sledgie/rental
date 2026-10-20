import { useStore, communicationsOf, partiesOf } from "../../state/store";
import { formatDate, relativeDays } from "../../lib/format";
import { Badge, MockTag } from "../../components/ui/Badge";
import { Button, IconButton } from "../../components/ui/Button";
import { EmptyHint, MiniTable, Note, Td } from "./parts";
import { IconChat, IconCheck, IconClock, IconPlus } from "../../components/icons";
import type { DialogRequest } from "./dialogTypes";

const METHOD_TONE: Record<string, "blue" | "indigo" | "emerald" | "amber" | "violet" | "neutral"> = {
  "Phone Call": "blue",
  Email: "indigo",
  "Text Message": "violet",
  "In Person": "emerald",
  Letter: "neutral",
  "Portal Message": "amber",
};

export function CommunicationsSection({
  applicationId,
  open,
}: {
  applicationId: string;
  open: (d: DialogRequest) => void;
}) {
  const { state, dispatch, toast } = useStore();
  const comms = communicationsOf(state, applicationId)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const parties = partiesOf(state, applicationId);
  const openFollowUps = comms.filter((c) => c.followUpStatus === "Open" || c.followUpStatus === "Overdue");

  return (
    <div className="space-y-3 rounded-xl border border-u-line bg-u-card/60 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13px] font-semibold text-u-ink">G. Communication and Follow-ups</h3>
            <Badge tone="blue">{comms.length} logged</Badge>
            {openFollowUps.length > 0 && (
              <Badge tone="amber">{openFollowUps.length} follow-up open</Badge>
            )}
          </div>
          <p className="mt-0.5 text-[11.5px] text-u-muted">
            Tracks contact with applicants. Logging a call or email here records the interaction — it does not send a
            message.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <MockTag label="Mock records only" />
          <Button size="xs" variant="secondary" icon={<IconChat width={12} height={12} />} onClick={() => open({ kind: "communication", method: "Phone Call" })}>
            Record Phone Call
          </Button>
          <Button size="xs" variant="secondary" onClick={() => open({ kind: "communication", method: "Email" })}>
            Record Email
          </Button>
          <Button size="xs" variant="ghost" icon={<IconPlus width={12} height={12} />} onClick={() => open({ kind: "communication" })}>
            Add Communication Note
          </Button>
          <Button size="xs" variant="ghost" icon={<IconClock width={12} height={12} />} onClick={() => open({ kind: "followUp" })}>
            Add Follow-up Task
          </Button>
        </div>
      </div>

      {comms.length === 0 ? (
        <EmptyHint>
          No communications recorded for this application yet. Use the actions above to log the first contact.
        </EmptyHint>
      ) : (
        <MiniTable head={["Date", "Method", "Applicant", "Subject", "Summary", "Staff", "Follow-up", ""]}>
          {comms.map((c) => {
            const party = parties.find((p) => p.id === c.applicationPartyId);
            const overdue = c.followUpStatus === "Overdue";
            return (
              <tr key={c.id} className="hover:bg-u-s2/50">
                <Td>{formatDate(c.createdAt)}</Td>
                <Td>
                  <Badge tone={METHOD_TONE[c.contactMethod] ?? "neutral"}>{c.contactMethod}</Badge>
                </Td>
                <Td>{party?.fullName ?? "Household"}</Td>
                <Td>
                  <span className="font-medium text-u-ink">{c.subject}</span>
                </Td>
                <Td>
                  <span className="block max-w-[300px] text-[11.5px] leading-snug text-u-muted">{c.summary}</span>
                </Td>
                <Td>{c.createdBy}</Td>
                <Td>
                  {c.followUpRequired || c.followUpStatus === "Completed" ? (
                    <div className="space-y-1">
                      <Badge tone={overdue ? "red" : c.followUpStatus === "Completed" ? "emerald" : "amber"}>
                        {c.followUpStatus}
                      </Badge>
                      {c.followUpDate && (
                        <p className="text-[11px] text-u-muted">
                          {formatDate(c.followUpDate)} · {relativeDays(c.followUpDate)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-u-muted">Not required</span>
                  )}
                </Td>
                <Td>
                  {c.followUpStatus !== "Completed" && (
                    <IconButton
                      label="Mark follow-up complete"
                      onClick={() => {
                        dispatch({
                          type: "COMPLETE_FOLLOW_UP",
                          communicationId: c.id,
                          completedBy: state.currentUser.name,
                        });
                        toast({
                          variant: "success",
                          title: "Follow-up marked complete",
                          description: `“${c.subject}” closed in the local activity log.`,
                          simulated: true,
                        });
                      }}
                    >
                      <IconCheck width={14} height={14} />
                    </IconButton>
                  )}
                </Td>
              </tr>
            );
          })}
        </MiniTable>
      )}

      <Note>
        No emails or text messages are actually sent from the prototype. A real integration would post to a messaging
        provider and write back the delivery status.
      </Note>
    </div>
  );
}
