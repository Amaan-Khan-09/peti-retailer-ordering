import { ChevronRight, MapPin, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { rupeeShort, timeAgo } from "../../format";
import { sync, useOffline } from "../../offline/store";
import { Avatar, Badge, Button, Card, EmptyState, Skeleton } from "../../ui";

export default function Beat() {
  const offline = useOffline();
  const [query, setQuery] = useState("");
  const bundle = offline.bundle;
  if (!bundle) {
    return offline.syncing ? <Skeleton rows={5} /> : (
      <EmptyState icon={MapPin} title="Download today's beat" body="Prices, schemes and stock for your shops are saved on this phone so you can take orders without signal."
        action={<Button onClick={() => sync()}>Download now</Button>} />
    );
  }
  const shown = bundle.shops.filter((s) => `${s.shop_name} ${s.area} ${s.owner_name}`.toLowerCase().includes(query.trim().toLowerCase()));
  const areas = [...new Set(shown.map((s) => s.area))];
  const dueShops = bundle.shops.filter((s) => s.suggestions.some((x) => x.due_in_days <= 0 && x.in_stock)).length;
  const waitingAll = offline.outbox.filter((e) => e.status === "pending").length;
  const sent = offline.outbox.filter((e) => e.status === "sent").length;
  const stats = [
    { label: "shops", value: bundle.shops.length },
    { label: "need stock", value: dueShops },
    { label: "orders sent", value: sent },
    { label: "waiting", value: waitingAll },
  ];
  return (
    <div className="animate-rise">
      <section className="hero relative mb-4 overflow-hidden rounded-3xl p-5 text-white shadow-lift">
        <div className="pointer-events-none absolute -top-12 -right-10 size-44 rounded-full bg-white/[0.06]" aria-hidden />
        <h1 className="relative text-2xl font-extrabold">Today's beat</h1>
        <p className="relative mt-1 text-sm text-white/70">Open a shop to take its order, with its own prices, schemes and credit.</p>
        <dl className="relative mt-4 grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl bg-white/10 px-2 py-2.5 text-center ring-1 ring-white/10">
              <dd className="num text-xl font-extrabold">{s.value}</dd>
              <dt className="text-[11px] leading-tight text-white/65">{s.label}</dt>
            </div>
          ))}
        </dl>
      </section>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-faint" aria-hidden />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Shop, owner or area" aria-label="Search shops"
          className="h-12 w-full rounded-2xl border border-ink/[0.06] bg-surface pr-4 pl-12 shadow-card outline-none placeholder:text-faint focus:border-accent/50 focus:shadow-[0_0_0_4px_rgb(15_122_69/0.12)]" />
      </div>
      {areas.map((area) => {
        const shops = shown.filter((s) => s.area === area);
        return (
          <section key={area} className="mb-5" aria-label={area}>
            <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted uppercase"><MapPin className="size-3.5 text-accent" aria-hidden />{area}<span className="font-semibold text-faint">· {shops.length}</span></h2>
            <ul className="space-y-2">
              {shops.map((shop) => {
                const due = shop.suggestions.filter((x) => x.due_in_days <= 0 && x.in_stock).length;
                const waiting = offline.outbox.filter((e) => e.retailer_id === shop.id && e.status === "pending").length;
                return (
                  <li key={shop.id}>
                    <Link to={`/s/shop/${shop.id}`} className="group block">
                      <Card className="flex items-center gap-3 p-3.5 transition-all group-hover:shadow-lift group-active:scale-[0.99]">
                        <Avatar name={shop.shop_name} />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold">{shop.shop_name}</p>
                          <p className="text-sm text-muted">{shop.owner_name} · credit left <span className="num font-semibold text-ink">{rupeeShort(shop.credit_available)}</span>
                            {shop.last_order_at ? ` · last order ${timeAgo(shop.last_order_at)}` : " · no orders yet"}</p>
                          {(due > 0 || waiting > 0 || shop.credit_available <= 0) && (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {due > 0 && <Badge tone="gold">{due} due</Badge>}
                              {waiting > 0 && <Badge tone="blue">{waiting} waiting to send</Badge>}
                              {shop.credit_available <= 0 && <Badge tone="red">Credit limit reached</Badge>}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="size-5 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
