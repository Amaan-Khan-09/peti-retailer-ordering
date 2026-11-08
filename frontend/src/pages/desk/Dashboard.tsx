import { ArrowUpRight, ClipboardCheck, FileSpreadsheet, MessageCircle, PackageX, PhoneCall, ShieldAlert, Store, Truck, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { rupeeShort, SOURCE_LABEL } from "../../format";
import type { Dashboard as Data } from "../../types";
import { Avatar, Badge, Card, EmptyState, ErrorState, Meter, PageHeader, Skeleton, cx, useAsync } from "../../ui";

const SOURCE_COLOR: Record<string, string> = { app: "#0f7a45", ai_capture: "#3fb878", salesman: "#d69a2d", desk_entry: "#c5ccc7" };

function Target({ label, value, goal, note, good, meter, marker }: { label: string; value: string; goal: string; note: string; good: boolean | null; meter?: number; marker?: number }) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted">{label}</p>
        {good !== null && <Badge tone={good ? "green" : "amber"}>{good ? "On track" : "Watch"}</Badge>}
      </div>
      <p className={cx("num mt-2 text-4xl font-extrabold tracking-tight", good === true && "text-accent", good === false && "text-warn")}>{value}</p>
      {meter !== undefined && <Meter value={meter} marker={marker} tone={good === false ? "warn" : "accent"} className="mt-3" />}
      <p className="mt-auto pt-3 text-xs text-muted"><span className="font-semibold text-ink">Target</span> {goal} · {note}</p>
    </Card>
  );
}

function Tile({ label, value, to, icon: Icon, urgent, tint }: { label: string; value: number; to: string; icon: LucideIcon; urgent?: boolean; tint: string }) {
  return (
    <Link to={to} className="group">
      <Card className="relative h-full p-4 transition-all group-hover:-translate-y-0.5 group-hover:shadow-lift">
        <div className="flex items-center justify-between">
          <span className={cx("grid size-10 place-items-center rounded-xl", tint)}><Icon className="size-5" aria-hidden /></span>
          <ArrowUpRight className="size-4 text-faint transition-colors group-hover:text-accent" aria-hidden />
        </div>
        <p className="num mt-4 text-3xl font-extrabold tracking-tight">{value}</p>
        <p className="mt-0.5 text-sm text-muted">{label}</p>
        {urgent && value > 0 && <span className="absolute top-4 right-10 size-2 rounded-full bg-gold ring-4 ring-gold-soft" aria-hidden />}
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const data = useAsync(() => api.get<Data>("/api/desk/dashboard"));
  if (data.error) return <ErrorState message={data.error} onRetry={data.reload} />;
  if (data.loading || !data.data) return <><PageHeader title="Overview" /><Skeleton rows={4} /></>;
  const d = data.data;
  const m = d.metrics;
  const mix = Object.entries(m.by_source).sort((a, b) => b[1] - a[1]);
  const pct = (n: number) => Math.round((100 * n) / Math.max(m.orders_30d, 1));
  return (
    <div className="animate-rise">
      <PageHeader title="Overview" subtitle="What needs the desk now, how the rollout is tracking, and which shops have gone quiet."
        actions={<Link to="/desk/loading" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold shadow-card hover:border-accent/40"><Truck className="size-4 text-accent" aria-hidden />Van loading</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="WhatsApp orders to read" value={d.new_messages} to="/desk/inbox" icon={MessageCircle} urgent tint="bg-[#e3f6ea] text-[#1f9d55]" />
        <Tile label="Orders to confirm" value={d.to_confirm} to="/desk/orders?tab=PLACED" icon={ClipboardCheck} urgent tint="bg-info-soft text-info" />
        <Tile label="On credit hold" value={d.credit_holds} to="/desk/orders?tab=CREDIT_HOLD" icon={ShieldAlert} urgent tint="bg-warn-soft text-warn" />
        <Tile label="Ready for Tally" value={d.ready_for_tally} to="/desk/orders?tab=CONFIRMED" icon={FileSpreadsheet} tint="bg-accent-soft text-accent" />
      </div>

      <section className="mt-10" aria-labelledby="targets">
        <h2 id="targets" className="text-lg font-bold">Success targets, last 30 days</h2>
        <p className="mb-4 text-sm text-muted">The client's three goals, measured from what Peti records.</p>
        <div className="grid gap-3 md:grid-cols-3">
          <Target label="Orders placed in the app or read by AI" value={`${m.digital_share}%`} goal={`${m.digital_target}% in 4 months`}
            note={`${m.orders_30d} orders`} good={m.digital_share >= m.digital_target} meter={m.digital_share} marker={m.digital_target} />
          <Target label="AI lines the desk had to correct" value={m.ai_corrected_pct === null ? "–" : `${m.ai_corrected_pct}%`}
            goal="orders with errors under 1%" note={`${m.ai_lines_checked} lines checked; every line is confirmed by a person`}
            good={m.ai_corrected_pct === null ? null : m.ai_corrected_pct < 5} />
          <Target label="Desk time per WhatsApp order (median)" value={m.median_desk_minutes === null ? "–" : `${m.median_desk_minutes} min`}
            goal="order team from 6 to 3" note={m.median_minutes_to_order === null ? "no AI orders yet" : `message to order in ${m.median_minutes_to_order} min`}
            good={m.median_desk_minutes === null ? null : m.median_desk_minutes <= 5} />
        </div>
        {mix.length > 0 && (
          <Card className="mt-3 p-5">
            <p className="text-sm font-semibold">How orders arrive</p>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full" role="img" aria-label={mix.map(([s, n]) => `${SOURCE_LABEL[s] ?? s} ${pct(n)}%`).join(", ")}>
              {mix.map(([source, n]) => <div key={source} style={{ width: `${pct(n)}%`, background: SOURCE_COLOR[source] ?? "#98a29c" }} className="h-full border-r-2 border-surface last:border-r-0" />)}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {mix.map(([source, n]) => (
                <li key={source} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: SOURCE_COLOR[source] ?? "#98a29c" }} aria-hidden />
                  <span className="text-muted">{SOURCE_LABEL[source] ?? source}</span><span className="num font-semibold">{pct(n)}%</span></li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {d.out_of_stock.length > 0 && (
        <p className="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted"><PackageX className="size-4 text-danger" aria-hidden />Out of stock: {d.out_of_stock.map((s) => <Badge key={s.code} tone="red">{s.name}</Badge>)}</p>
      )}

      <section className="mt-10" aria-labelledby="quiet">
        <h2 id="quiet" className="text-lg font-bold">No order in 14 days</h2>
        <p className="mb-4 text-sm text-muted">{d.quiet_retailers.length} shops. Longest gap first; a call now usually saves the next order.</p>
        {d.quiet_retailers.length === 0 ? <Card><EmptyState icon={Store} title="Every shop has ordered in the last 14 days" /></Card> : (
          <Card className="divide-y divide-line overflow-hidden">
            {d.quiet_retailers.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas/60">
                <Avatar name={r.shop_name} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r.shop_name} <span className="text-sm font-normal text-muted">· {r.area}</span></p>
                  <p className="text-sm text-muted">{r.owner_name} · credit left <span className="num">{rupeeShort(r.credit_available)}</span></p>
                </div>
                <Badge tone={r.days_since_order === null || r.days_since_order > 25 ? "red" : "amber"}>
                  {r.days_since_order === null ? "Never ordered" : `${r.days_since_order} days`}
                </Badge>
                <a href={`tel:+91${r.phone}`} className="inline-flex h-9 items-center gap-2 rounded-xl bg-accent px-3 text-sm font-semibold text-white shadow-glow transition-transform active:scale-95">
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
