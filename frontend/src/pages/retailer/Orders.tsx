import { ChevronRight, ClipboardList } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { dateTime, rupee, SOURCE_LABEL } from "../../format";
import { useLang } from "../../i18n";
import type { Order } from "../../types";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton, STATUS_TONE, useAsync } from "../../ui";

export default function Orders() {
  const { t, status } = useLang();
  const orders = useAsync(() => api.get<Order[]>("/api/orders"));
  if (orders.error) return <ErrorState message={orders.error} onRetry={orders.reload} />;
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">{t("orders")}</h1>
      {orders.loading ? <Skeleton rows={5} /> : !orders.data?.length ? (
        <EmptyState icon={ClipboardList} title={t("noOrders")} action={<Link to="/"><Button>{t("goShop")}</Button></Link>} />
      ) : (
        <ul className="space-y-3">
          {orders.data.map((o) => (
            <li key={o.id}>
              <Link to={`/orders/${o.id}`}>
                <Card className="flex items-center gap-4 p-4 hover:border-accent">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="num font-semibold">{o.number}</p>
                      <Badge tone={STATUS_TONE[o.status]}>{status(o.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted">{dateTime(o.created_at)} · {o.line_count} {t("items")} · {SOURCE_LABEL[o.source]}</p>
                  </div>
                  <p className="num font-semibold">{rupee(o.total)}</p>
                  <ChevronRight className="size-5 text-faint" aria-hidden />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
