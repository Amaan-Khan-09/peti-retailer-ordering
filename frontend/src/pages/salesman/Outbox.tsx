import { AlertTriangle, CheckCircle2, CloudOff, Inbox } from "lucide-react";
import { dateTime, rupee } from "../../format";
import { useLang } from "../../i18n";
import { removeEntry, retryEntry, sync, useOffline } from "../../offline/store";
import { Badge, Button, Card, EmptyState, STATUS_TONE } from "../../ui";

export default function Outbox() {
  const offline = useOffline();
  const { status } = useLang();
  const waiting = offline.outbox.filter((e) => e.status === "pending");
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Outbox</h1>
          <p className="text-sm text-muted">Orders taken on this phone. Waiting orders are sent automatically when there is signal.</p>
        </div>
        {waiting.length > 0 && <Button onClick={() => sync()} loading={offline.syncing}>Send {waiting.length} now</Button>}
      </div>
      {offline.lastError && <p role="alert" className="mb-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{offline.lastError}</p>}
      {offline.outbox.length === 0 ? <Card><EmptyState icon={Inbox} title="No orders taken yet today" /></Card> : (
        <ul className="space-y-3">
          {offline.outbox.map((e) => (
            <li key={e.client_ref}>
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {e.status === "sent" ? <CheckCircle2 className="size-5 text-accent" aria-hidden /> : e.status === "failed"
                      ? <AlertTriangle className="size-5 text-danger" aria-hidden /> : <CloudOff className="size-5 text-warn" aria-hidden />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{e.shop_name}</p>
                    <p className="text-sm text-muted">{dateTime(e.created_at)} · {e.lines.length} lines · {rupee(e.order?.total ?? e.estimate)}{e.order ? "" : " (estimate)"}</p>
                    {e.status === "sent" && e.order && (
                      <p className="mt-1 flex items-center gap-2 text-sm"><span className="num font-medium">{e.order.number}</span><Badge tone={STATUS_TONE[e.order.status]}>{status(e.order.status)}</Badge></p>
                    )}
                    {e.status === "pending" && <p className="mt-1 text-sm text-warn">Waiting for signal</p>}
                    {e.status === "failed" && (
                      <div className="mt-1 text-sm text-danger">
                        <p>{e.error}</p>
                        {e.details?.map((d) => <p key={d}>• {d}</p>)}
                        <p className="mt-1 text-muted">Stock or credit changed since the order was taken. Fix it with the shop, then retry or remove it.</p>
                      </div>
                    )}
                  </div>
                </div>
                {e.status === "failed" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => retryEntry(e.client_ref)}>Retry</Button>
                    <Button size="sm" variant="danger" onClick={() => removeEntry(e.client_ref)}>Remove</Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
