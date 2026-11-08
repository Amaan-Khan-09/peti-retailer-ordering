import { ArrowLeft, Check, MessageCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { dateTime, rupee } from "../../format";
import { useLang } from "../../i18n";
import type { Order } from "../../types";
import { Badge, Card, ErrorState, Skeleton, STATUS_TONE, cx, useAsync } from "../../ui";
import { Totals } from "./Cart";

export function OrderLines({ order }: { order: Order }) {
  const { t, name } = useLang();
  return (
    <ul className="divide-y divide-line">
      {order.lines?.map((l) => (
        <li key={l.sku_id + l.unit} className="flex justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="font-medium">{name(l)}</p>
            <p className="num text-sm text-muted">{l.qty} {l.unit === "CASE" ? "case" : "pc"}{l.qty > 1 && l.unit === "CASE" ? "s" : ""} × {rupee(l.unit_price)}/pc{l.free_cases ? ` · +${l.free_cases} free` : ""}</p>
            {l.scheme_note && <p className="text-xs text-accent">{l.scheme_note}</p>}
          </div>
          <p className="num shrink-0 text-right font-medium">{rupee(l.total)}<span className="block text-[11px] font-normal text-muted">{t("inclGst")}</span></p>
        </li>
      ))}
    </ul>
  );
}

export function OrderMessages({ order }: { order: Order }) {
  const { t } = useLang();
  if (!order.messages?.length) return null;
  return (
    <Card className="p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted"><MessageCircle className="size-4" aria-hidden />{t("whatsapp")}</h2>
      <ul className="space-y-2">
        {order.messages.map((m) => (
          <li key={m.created_at + m.text} className="max-w-md rounded-2xl rounded-tr-sm bg-[#e7f5ee] px-4 py-2.5 text-sm">
            {m.text}<span className="mt-1 block text-right text-[11px] text-muted">{dateTime(m.created_at)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function OrderDetail({ backTo = "/orders" }: { backTo?: string }) {
  const { id } = useParams();
  const { t, status } = useLang();
  const order = useAsync(() => api.get<Order>(`/api/orders/${id}`), [id]);
  if (order.error) return <ErrorState message={order.error} onRetry={order.reload} />;
  if (order.loading || !order.data) return <Skeleton rows={4} />;
  const o = order.data;
  const steps = [
    { at: o.created_at, label: t("stepPlaced") }, { at: o.confirmed_at, label: t("stepConfirmed") }, { at: o.exported_at, label: t("stepBilled") },
  ];
  return (
    <div className="space-y-4">
      <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> {t("orders")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="num text-xl font-semibold">{o.number}</h1>
        <Badge tone={STATUS_TONE[o.status]}>{status(o.status)}</Badge>
      </div>
      {o.status === "CREDIT_HOLD" && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">{o.hold_reason}</p>}
      {o.status !== "CANCELLED" && (
        <ol className="flex gap-2">
          {steps.map((s) => (
            <li key={s.label} className="flex-1">
              <div className={cx("h-1.5 rounded-full", s.at ? "bg-accent" : "bg-line")} />
              <p className={cx("mt-2 flex items-center gap-1 text-xs", s.at ? "text-ink" : "text-faint")}>{s.at && <Check className="size-3" aria-hidden />}{s.label}</p>
              {s.at && <p className="text-xs text-muted">{dateTime(s.at)}</p>}
            </li>
          ))}
        </ol>
      )}
      <Card className="px-5"><OrderLines order={o} /></Card>
      <Card className="p-5"><Totals quote={o} /></Card>
      <OrderMessages order={o} />
    </div>
  );
}
