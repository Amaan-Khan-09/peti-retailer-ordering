import { PhoneCall, Store } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { rupeeShort } from "../../format";
import type { Dashboard as Data } from "../../types";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton, useAsync } from "../../ui";

export default function Dashboard() {
  const data = useAsync(() => api.get<Data>("/api/desk/dashboard"));
  if (data.error) return <ErrorState message={data.error} onRetry={data.reload} />;
  if (data.loading || !data.data) return <><PageHeader title="Overview" /><Skeleton rows={4} /></>;
  const d = data.data;
  const tiles = [
    { label: "WhatsApp orders to read", value: d.new_messages, to: "/desk/inbox", urgent: d.new_messages > 0 },
    { label: "Orders to confirm", value: d.to_confirm, to: "/desk/orders?tab=PLACED", urgent: d.to_confirm > 0 },
    { label: "On credit hold", value: d.credit_holds, to: "/desk/orders?tab=CREDIT_HOLD", urgent: d.credit_holds > 0 },
    { label: "Ready for Tally", value: d.ready_for_tally, to: "/desk/orders?tab=CONFIRMED" },
    { label: "Orders today", value: d.orders_today },
    { label: "Captured by AI, last 7 days", value: `${d.ai_share_week}%` },
  ];
  return (
    <div>
      <PageHeader title="Overview" subtitle="What needs the desk now, and which shops have gone quiet." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {tiles.map((tile) => {
          const body = (
            <Card className="h-full p-4 hover:border-accent">
              <p className="text-sm text-muted">{tile.label}</p>
              <p className={`num mt-2 text-3xl font-semibold ${tile.urgent ? "text-accent" : ""}`}>{tile.value}</p>
            </Card>
          );
          return tile.to ? <Link key={tile.label} to={tile.to}>{body}</Link> : <div key={tile.label}>{body}</div>;
        })}
      </div>

      {d.out_of_stock.length > 0 && (
        <p className="mt-5 text-sm text-muted">Out of stock: {d.out_of_stock.map((s) => <Badge key={s.code} tone="red" className="mr-1">{s.name}</Badge>)}</p>
      )}

      <section className="mt-8" aria-labelledby="quiet">
        <h2 id="quiet" className="text-lg font-semibold">No order in 14 days</h2>
        <p className="mb-3 text-sm text-muted">{d.quiet_retailers.length} shops. Longest gap first; a call now usually saves the next order.</p>
        {d.quiet_retailers.length === 0 ? <Card><EmptyState icon={Store} title="Every shop has ordered in the last 14 days" /></Card> : (
          <Card className="divide-y divide-line">
            {d.quiet_retailers.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.shop_name} <span className="text-sm font-normal text-muted">· {r.area}</span></p>
                  <p className="text-sm text-muted">{r.owner_name} · credit left <span className="num">{rupeeShort(r.credit_available)}</span></p>
                </div>
                <Badge tone={r.days_since_order === null || r.days_since_order > 25 ? "red" : "amber"}>
                  {r.days_since_order === null ? "Never ordered" : `${r.days_since_order} days`}
                </Badge>
                <a href={`tel:+91${r.phone}`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium hover:border-accent">
                  <PhoneCall className="size-4" aria-hidden /> Call
                </a>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
