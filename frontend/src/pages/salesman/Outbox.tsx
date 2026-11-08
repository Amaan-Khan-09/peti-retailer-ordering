import { AlertTriangle, CheckCircle2, CloudOff, Inbox } from "lucide-react";
import { dateTime, rupee } from "../../format";
import { useLang } from "../../i18n";
import { removeEntry, retryEntry, sync, useOffline } from "../../offline/store";
import { Badge, Button, Card, EmptyState, STATUS_TONE } from "../../ui";

export default function Outbox() {
  const offline = useOffline();
  const { t, status } = useLang();
  const waiting = offline.outbox.filter((e) => e.status === "pending");
  return (
    <div className="animate-rise">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("outbox")}</h1>
          <p className="text-sm text-muted">{t("outboxBody")}</p>
        </div>
        {waiting.length > 0 && <Button onClick={() => sync()} loading={offline.syncing}>{t("sendNow", { n: waiting.length })}</Button>}
      </div>
      {offline.lastError && <p role="alert" className="mb-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{offline.lastError}</p>}
      {offline.outbox.length === 0 ? <Card><EmptyState icon={Inbox} title={t("noOutbox")} /></Card> : (
        <ul className="space-y-3">
          {offline.outbox.map((e) => (
            <li key={e.client_ref}>
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <div className={e.status === "sent" ? "grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent" : e.status === "failed"
                    ? "grid size-10 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger" : "grid size-10 shrink-0 place-items-center rounded-xl bg-warn-soft text-warn"}>
                    {e.status === "sent" ? <CheckCircle2 className="size-5" aria-hidden /> : e.status === "failed"
                      ? <AlertTriangle className="size-5" aria-hidden /> : <CloudOff className="size-5" aria-hidden />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{e.shop_name}</p>
                    <p className="num text-sm text-muted">{dateTime(e.created_at)} · {t("lineCount", { n: e.lines.length })} · {rupee(e.order?.total ?? e.estimate)}{e.order ? "" : ` ${t("estimate")}`}</p>
                    {e.status === "sent" && e.order && (
                      <p className="mt-1 flex items-center gap-2 text-sm"><span className="num font-semibold">{e.order.number}</span><Badge tone={STATUS_TONE[e.order.status]}>{status(e.order.status)}</Badge></p>
                    )}
                    {e.status === "pending" && <p className="mt-1 text-sm font-medium text-warn">{t("waitingSignal")}</p>}
                    {e.status === "failed" && (
                      <div className="mt-1 text-sm text-danger">
                        <p>{e.error}</p>
                        {e.details?.map((d) => <p key={d}>• {d}</p>)}
                        <p className="mt-1 text-muted">{t("fixWithShop")}</p>
                      </div>
                    )}
                  </div>
                </div>
                {e.status === "failed" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => retryEntry(e.client_ref)}>{t("retry")}</Button>
                    <Button size="sm" variant="danger" onClick={() => removeEntry(e.client_ref)}>{t("remove")}</Button>
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
