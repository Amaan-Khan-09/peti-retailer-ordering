import { PhoneCall, Store, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { rupeeShort, SOURCE_LABEL } from "../../format";
import type { Dashboard as Data } from "../../types";
import { Badge, Card, EmptyState, ErrorState, PageHeader, Skeleton, cx, useAsync } from "../../ui";

function Target({ label, value, goal, note, good }: { label: string; value: string; goal: string; note: string; good: boolean | null }) {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={cx("num mt-2 text-3xl font-semibold", good === true && "text-accent", good === false && "text-warn")}>{value}</p>
      <p className="mt-1 text-xs text-muted">Target {goal} · {note}</p>
    </Card>
  );
}

export default function Dashboard() {
  const data = useAsync(() => api.get<Data>("/api/desk/dashboard"));
  if (data.error) return <ErrorState message={data.error} onRetry={data.reload} />;
  if (data.loading || !data.data) return <><PageHeader title="Overview" /><Skeleton rows={4} /></>;
  const d = data.data;
  const m = d.metrics;
  const tiles = [
    { label: "WhatsApp orders to read", value: d.new_messages, to: "/desk/inbox", urgent: d.new_messages > 0 },
    { label: "Orders to confirm", value: d.to_confirm, to: "/desk/orders?tab=PLACED", urgent: d.to_confirm > 0 },
    { label: "On credit hold", value: d.credit_holds, to: "/desk/orders?tab=CREDIT_HOLD", urgent: d.credit_holds > 0 },
    { label: "Ready for Tally", value: d.ready_for_tally, to: "/desk/orders?tab=CONFIRMED" },
  ];
  const mix = Object.entries(m.by_source).sort((a, b) => b[1] - a[1]);
  return (
    <div>
      <PageHeader title="Overview" subtitle="What needs the desk now, how the rollout is tracking, and which shops have gone quiet."
        actions={<Link to="/desk/loading" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[15px] font-medium hover:border-accent"><Truck className="size-4" aria-hidden />Van loading</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} to={tile.to}>
            <Card className="h-full p-4 hover:border-accent">
              <p className="text-sm text-muted">{tile.label}</p>
              <p className={`num mt-2 text-3xl font-semibold ${tile.urgent ? "text-accent" : ""}`}>{tile.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      <section className="mt-8" aria-labelledby="targets">
        <h2 id="targets" className="text-lg font-semibold">Success targets, last 30 days</h2>
        <p className="mb-3 text-sm text-muted">The client's three goals, measured from what Peti records.</p>
        <div className="grid gap-3 md:grid-cols-3">
          <Target label="Orders placed in the app or read by AI" value={`${m.digital_share}%`} goal={`${m.digital_target}% in 4 months`}
            note={`${m.orders_30d} orders`} good={m.digital_share >= m.digital_target} />
          <Target label="AI lines the desk had to correct" value={m.ai_corrected_pct === null ? "–" : `${m.ai_corrected_pct}%`}
            goal="orders with errors under 1%" note={`${m.ai_lines_checked} lines checked; every line is confirmed by a person`}
            good={m.ai_corrected_pct === null ? null : m.ai_corrected_pct < 5} />
          <Target label="Desk time per WhatsApp order (median)" value={m.median_desk_minutes === null ? "–" : `${m.median_desk_minutes} min`}
            goal="order team from 6 to 3" note={m.median_minutes_to_order === null ? "no AI orders yet" : `message to order in ${m.median_minutes_to_order} min`}
            good={m.median_desk_minutes === null ? null : m.median_desk_minutes <= 5} />
        </div>
        {mix.length > 0 && (
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-sm text-muted">How orders arrive:
            {mix.map(([source, n]) => <Badge key={source} tone={source === "desk_entry" ? "neutral" : "green"}>{SOURCE_LABEL[source] ?? source} {Math.round((100 * n) / m.orders_30d)}%</Badge>)}
          </p>
        )}
      </section>

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
