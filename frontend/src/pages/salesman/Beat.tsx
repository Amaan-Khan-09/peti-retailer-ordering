import { ChevronRight, MapPin, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { rupeeShort, timeAgo } from "../../format";
import { sync, useOffline } from "../../offline/store";
import { Badge, Button, Card, EmptyState, Skeleton } from "../../ui";

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
  return (
    <div>
      <h1 className="text-xl font-semibold">Today's beat</h1>
      <p className="mb-4 text-sm text-muted">{bundle.shops.length} shops. Open a shop to take its order, with its own prices, schemes and credit.</p>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-faint" aria-hidden />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Shop, owner or area" aria-label="Search shops"
          className="h-12 w-full rounded-xl border border-line bg-surface pr-4 pl-12 outline-none focus:border-accent" />
      </div>
      {areas.map((area) => (
        <section key={area} className="mb-5" aria-label={area}>
          <h2 className="mb-2 text-sm font-medium text-muted">{area}</h2>
          <ul className="space-y-2">
            {shown.filter((s) => s.area === area).map((shop) => {
              const due = shop.suggestions.filter((x) => x.due_in_days <= 0 && x.in_stock).length;
              const waiting = offline.outbox.filter((e) => e.retailer_id === shop.id && e.status === "pending").length;
              return (
                <li key={shop.id}>
                  <Link to={`/s/shop/${shop.id}`}>
                    <Card className="flex items-center gap-3 p-4 hover:border-accent">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{shop.shop_name}</p>
                        <p className="text-sm text-muted">{shop.owner_name} · credit left <span className="num">{rupeeShort(shop.credit_available)}</span>
                          {shop.last_order_at ? ` · last order ${timeAgo(shop.last_order_at)}` : " · no orders yet"}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {due > 0 && <Badge tone="amber">{due} due</Badge>}
                          {waiting > 0 && <Badge tone="blue">{waiting} waiting to send</Badge>}
                          {shop.credit_available <= 0 && <Badge tone="red">Credit limit reached</Badge>}
                        </div>
                      </div>
                      <ChevronRight className="size-5 text-faint" aria-hidden />
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
