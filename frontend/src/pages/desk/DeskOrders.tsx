import { ChevronDown, ClipboardList, Download, Search } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../../api";
import { dateTime, rupee, SOURCE_LABEL, STATUS_LABEL } from "../../format";
import type { Order } from "../../types";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, STATUS_TONE, cx, useAsync, useToast } from "../../ui";
import { OrderLines } from "../retailer/OrderDetail";

const TABS = ["PLACED", "CREDIT_HOLD", "CONFIRMED", "EXPORTED", "CANCELLED"] as const;

export default function DeskOrders() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "PLACED";
  const [query, setQuery] = useState("");
  const orders = useAsync(() => api.get<Order[]>(`/api/orders?status=${tab}${query ? `&q=${encodeURIComponent(query)}` : ""}`), [tab, query]);
  const counts = useAsync(() => api.get<Order[]>("/api/orders?status=PLACED,CREDIT_HOLD,CONFIRMED"), [tab]);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();
  const count = (s: string) => counts.data?.filter((o) => o.status === s).length;

  async function exportTally(format: "xml" | "csv") {
    setExporting(true);
    try {
      const n = await api.download("/api/desk/export", { format });
      toast(`${n} order${n === 1 ? "" : "s"} exported for Tally`);
      orders.reload();
      counts.reload();
    } catch (e) {
      toast((e as ApiError).message, "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Orders" subtitle="Confirm orders, clear credit holds, then send confirmed orders to Tally."
        actions={<>
          <Button onClick={() => exportTally("xml")} loading={exporting} disabled={!count("CONFIRMED")}><Download className="size-4" aria-hidden />Export to Tally{count("CONFIRMED") ? ` (${count("CONFIRMED")})` : ""}</Button>
          <Button variant="secondary" onClick={() => exportTally("csv")} disabled={exporting || !count("CONFIRMED")}>CSV</Button>
        </>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0" role="tablist">
          {TABS.map((s) => (
            <button key={s} role="tab" aria-selected={tab === s} onClick={() => setParams({ tab: s })}
              className={cx("h-9 shrink-0 rounded-full px-4 text-sm font-medium", tab === s ? "bg-ink text-white" : "text-muted hover:bg-surface")}>
              {STATUS_LABEL[s]}{count(s) ? ` · ${count(s)}` : ""}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full md:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Shop or order number" aria-label="Search orders"
            className="h-10 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-sm outline-none focus:border-accent" />
        </div>
      </div>
      {orders.error ? <ErrorState message={orders.error} onRetry={orders.reload} /> : orders.loading ? <Skeleton rows={5} /> :
        !orders.data?.length ? <Card><EmptyState icon={ClipboardList} title={`No orders here`} body={tab === "PLACED" ? "New orders from the app and WhatsApp land here." : undefined} /></Card> : (
          <Card className="divide-y divide-line">
            {orders.data.map((o) => <OrderRow key={o.id} order={o} onChanged={() => { orders.reload(); counts.reload(); }} />)}
          </Card>
        )}
    </div>
  );
}

function OrderRow({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Order | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  async function toggle() {
    setOpen(!open);
    if (!detail) setDetail(await api.get<Order>(`/api/orders/${order.id}`).catch(() => null));
  }
  async function act(action: "confirm" | "release" | "cancel") {
    if (action === "cancel" && !window.confirm(`Cancel ${order.number}? Stock goes back on the shelf.`)) return;
    setBusy(action);
    try {
      await api.post(`/api/desk/orders/${order.id}/${action}`);
      toast(`${order.number} ${action === "cancel" ? "cancelled" : "confirmed"}`);
      onChanged();
    } catch (e) {
      toast((e as ApiError).message, "error");
      setBusy(null);
    }
  }

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={toggle} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={open}>
          <ChevronDown className={cx("size-4 shrink-0 text-faint transition-transform", open && "rotate-180")} aria-hidden />
          <div className="min-w-0">
            <p className="font-medium"><span className="num">{order.number}</span> · {order.retailer.shop_name}</p>
            <p className="text-sm text-muted">{order.retailer.area} · {dateTime(order.created_at)} · {order.line_count} lines · {SOURCE_LABEL[order.source]}</p>
          </div>
        </button>
        <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
        <p className="num w-28 text-right font-semibold">{rupee(order.total)}</p>
        <div className="flex gap-2">
          {order.status === "PLACED" && <Button size="sm" onClick={() => act("confirm")} loading={busy === "confirm"}>Confirm</Button>}
          {order.status === "CREDIT_HOLD" && <Button size="sm" onClick={() => act("release")} loading={busy === "release"}>Approve credit</Button>}
          {["PLACED", "CREDIT_HOLD", "CONFIRMED"].includes(order.status) && <Button size="sm" variant="danger" onClick={() => act("cancel")} loading={busy === "cancel"}>Cancel</Button>}
        </div>
      </div>
      {order.hold_reason && order.status === "CREDIT_HOLD" && <p className="mt-2 ml-7 text-sm text-warn">{order.hold_reason}</p>}
      {open && (
        <div className="mt-2 ml-7">
          {detail ? <OrderLines order={detail} /> : <Skeleton rows={1} />}
          {detail?.note && <p className="mt-2 text-sm text-muted">Note: {detail.note}</p>}
        </div>
      )}
    </div>
  );
}
