import { Printer, Truck } from "lucide-react";
import { useState } from "react";
import { api } from "../../api";
import { rupee } from "../../format";
import type { LoadingItem, LoadingList as Data } from "../../types";
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, useAsync } from "../../ui";

const todayIst = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

function Items({ items }: { items: LoadingItem[] }) {
  return (
    <table className="w-full text-sm">
      <thead><tr className="border-b border-line text-left text-muted"><th className="py-2 font-medium">Product</th><th className="py-2 text-right font-medium">Cases</th><th className="py-2 text-right font-medium">Free</th><th className="py-2 text-right font-medium">Loose pcs</th><th className="py-2 text-right font-medium">Load</th></tr></thead>
      <tbody className="num">
        {items.map((i) => (
          <tr key={i.code} className="border-b border-line last:border-0">
            <td className="py-2">{i.name} <span className="text-xs text-muted">{i.code}</span></td>
            <td className="py-2 text-right">{i.cases}</td>
            <td className="py-2 text-right text-accent">{i.free_cases || "–"}</td>
            <td className="py-2 text-right">{i.pieces || "–"}</td>
            <td className="py-2 text-right font-semibold">{i.cases + i.free_cases}{i.pieces ? ` + ${i.pieces} pcs` : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function LoadingList() {
  const [day, setDay] = useState(todayIst);
  const data = useAsync(() => api.get<Data>(`/api/desk/loading-list?day=${day}`), [day]);
  return (
    <div>
      <PageHeader title="Van loading" subtitle="Orders confirmed on the day, grouped by area: one sheet per van run. Free cases are loaded too."
        actions={<>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value || todayIst())} aria-label="Day" className="h-11 rounded-xl border border-line bg-surface px-3 print:hidden" />
          <Button variant="secondary" onClick={() => window.print()} className="print:hidden" disabled={!data.data?.order_count}><Printer className="size-4" aria-hidden />Print</Button>
        </>} />
      {data.error ? <ErrorState message={data.error} onRetry={data.reload} /> : data.loading || !data.data ? <Skeleton rows={4} /> :
        data.data.order_count === 0 ? <Card><EmptyState icon={Truck} title="Nothing to load for this day" body="Confirmed orders appear here, grouped by area." /></Card> : (
          <div className="space-y-5">
            {data.data.routes.map((route) => (
              <Card key={route.area} className="break-inside-avoid p-5">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-semibold">{route.area}</h2>
                  <p className="num text-sm text-muted">{route.orders.length} order{route.orders.length > 1 ? "s" : ""} · {route.total_cases} cases</p>
                </div>
                <Items items={route.items} />
                <h3 className="mt-4 mb-1 text-sm font-medium text-muted">Drop list</h3>
                <ul className="num divide-y divide-line text-sm">
                  {route.orders.map((o) => (
                    <li key={o.number} className="flex justify-between gap-3 py-1.5">
                      <span>{o.number} · {o.shop_name}</span>
                      <span className="text-muted">{o.cases} cases{o.pieces ? ` + ${o.pieces} pcs` : ""} · {rupee(o.total)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
            <Card className="break-inside-avoid p-5">
              <h2 className="mb-3 text-lg font-semibold">All vans: pick from the warehouse</h2>
              <Items items={data.data.totals} />
            </Card>
          </div>
        )}
    </div>
  );
}
