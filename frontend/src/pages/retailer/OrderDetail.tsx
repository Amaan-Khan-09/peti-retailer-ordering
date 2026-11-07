import { ArrowLeft, Check } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { dateTime, rupee, STATUS_LABEL } from "../../format";
import { useLang } from "../../i18n";
import type { Order } from "../../types";
import { Badge, Card, ErrorState, Skeleton, STATUS_TONE, cx, useAsync } from "../../ui";
import { Totals } from "./Cart";

const STEPS = [
  { key: "created_at", label: "Placed" },
  { key: "confirmed_at", label: "Confirmed by desk" },
  { key: "exported_at", label: "Billed in Tally" },
] as const;

export function OrderLines({ order }: { order: Order }) {
  return (
    <ul className="divide-y divide-line">
      {order.lines?.map((l) => (
        <li key={l.sku_id + l.unit} className="flex justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="font-medium">{l.name}</p>
            <p className="num text-sm text-muted">{l.qty} {l.unit === "CASE" ? "case" : "pc"}{l.qty > 1 && l.unit === "CASE" ? "s" : ""} × {rupee(l.unit_price)}/pc{l.free_cases ? ` · +${l.free_cases} free` : ""}</p>
            {l.scheme_note && <p className="text-xs text-accent">{l.scheme_note}</p>}
          </div>
          <p className="num shrink-0 font-medium">{rupee(l.total)}</p>
        </li>
      ))}
    </ul>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const { t } = useLang();
  const order = useAsync(() => api.get<Order>(`/api/orders/${id}`), [id]);
  if (order.error) return <ErrorState message={order.error} onRetry={order.reload} />;
  if (order.loading || !order.data) return <Skeleton rows={4} />;
  const o = order.data;
  return (
    <div className="space-y-4">
      <Link to="/orders" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> {t("orders")}</Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="num text-xl font-semibold">{o.number}</h1>
        <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
      </div>
      {o.status === "CREDIT_HOLD" && <p className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">{o.hold_reason}</p>}
      {o.status !== "CANCELLED" && (
        <ol className="flex gap-2">
          {STEPS.map((s) => {
            const at = o[s.key];
            return (
              <li key={s.key} className="flex-1">
                <div className={cx("h-1.5 rounded-full", at ? "bg-accent" : "bg-line")} />
                <p className={cx("mt-2 flex items-center gap-1 text-xs", at ? "text-ink" : "text-faint")}>{at && <Check className="size-3" aria-hidden />}{s.label}</p>
                {at && <p className="text-xs text-muted">{dateTime(at)}</p>}
              </li>
            );
          })}
        </ol>
      )}
      <Card className="px-5"><OrderLines order={o} /></Card>
      <Card className="p-5"><Totals quote={{ ...o, lines: [], errors: [] }} /></Card>
    </div>
  );
}
