import { Gift, PackageSearch, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useCart } from "../../cart";
import { rupee } from "../../format";
import { useLang } from "../../i18n";
import type { Sku, Unit } from "../../types";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton, Stepper, cx, useAsync, useToast } from "../../ui";
import ProductTile from "./ProductTile";

export default function Shop() {
  const { t } = useLang();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const catalogue = useAsync(() => api.get<{ items: Sku[] }>("/api/catalogue"));
  const repeat = useAsync(() => api.get<{ order_number: string | null; lines: { sku_id: number; qty: number; unit: Unit }[] }>("/api/orders/repeat"));
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const items = catalogue.data?.items ?? [];
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))], [items]);
  const shown = items.filter((i) => (!category || i.category === category) &&
    (!query || `${i.name} ${i.brand} ${i.code}`.toLowerCase().includes(query.trim().toLowerCase())));

  function repeatLast() {
    const inStock = new Set(items.filter((i) => i.stock_status !== "OUT").map((i) => i.id));
    const lines = repeat.data!.lines.filter((l) => inStock.has(l.sku_id));
    const skipped = repeat.data!.lines.length - lines.length;
    cart.replace(lines);
    if (skipped) toast(`${skipped} item${skipped > 1 ? "s are" : " is"} out of stock and left out`);
    navigate("/cart");
  }

  if (catalogue.error) return <ErrorState message={catalogue.error} onRetry={catalogue.reload} />;

  return (
    <div>
      {repeat.data?.order_number && (
        <Card className="mb-5 flex items-center gap-4 p-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><RotateCcw className="size-5" aria-hidden /></div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t("repeat")}</p>
            <p className="text-sm text-muted">{t("repeatBody")} {repeat.data.order_number} · {repeat.data.lines.length} {t("items")}</p>
          </div>
          <Button onClick={repeatLast} disabled={!items.length}>{t("add")}</Button>
        </Card>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-faint" aria-hidden />
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")}
          className="h-12 w-full rounded-xl border border-line bg-surface pr-4 pl-12 outline-none focus:border-accent" />
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Categories">
        {[null, ...categories].map((c) => (
          <button key={c ?? "all"} role="tab" aria-selected={category === c} onClick={() => setCategory(c)}
            className={cx("h-9 shrink-0 rounded-full border px-4 text-sm font-medium", category === c ? "border-accent bg-accent text-white" : "border-line bg-surface text-muted")}>
            {c ?? t("all")}
          </button>
        ))}
      </div>

      {catalogue.loading && !items.length ? <Skeleton rows={6} className="mt-5" /> : shown.length === 0 ? (
        <EmptyState icon={PackageSearch} title={t("noResults")} action={<Button variant="secondary" onClick={() => { setQuery(""); setCategory(null); }}>{t("all")}</Button>} />
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((sku) => <ProductRow key={sku.id} sku={sku} />)}
        </ul>
      )}

      {cart.items.length > 0 && (
        <Link to="/cart" className="fixed inset-x-4 bottom-20 z-20 mx-auto flex h-14 max-w-3xl items-center justify-between rounded-2xl bg-ink px-5 text-white shadow-lg md:bottom-6">
          <span className="font-medium">{cart.items.length} {t("items")}</span>
          <span className="font-semibold">{t("viewCart")} →</span>
        </Link>
      )}
    </div>
  );
}

function ProductRow({ sku }: { sku: Sku }) {
  const { t } = useLang();
  const cart = useCart();
  const qty = cart.qtyOf(sku.id);
  const out = sku.stock_status === "OUT";
  return (
    <li>
      <Card className={cx("flex gap-4 p-3", out && "opacity-70")}>
        <ProductTile category={sku.category} pack={sku.pack} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{sku.name}</p>
          <p className="text-xs text-muted">{sku.brand.replace(/ \(.*\)/, "")} · {t("perCase")} = {sku.units_per_case} {t("pieces")}</p>
          <p className="mt-1.5">
            <span className="num font-semibold">{rupee(sku.case_price)}</span><span className="text-sm text-muted">/{t("perCase")}</span>
            <span className="num ml-2 text-xs text-muted">{rupee(sku.price)}/{t("perPiece")} · {t("exclGst")}</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sku.schemes.map((s) => <Badge key={s} tone="green"><Gift className="size-3" aria-hidden />{s}</Badge>)}
            {sku.stock_status === "LOW" && <Badge tone="amber">{t("lowStock", { n: sku.stock_cases })}</Badge>}
            {out && <Badge tone="red">{t("outOfStock")}</Badge>}
          </div>
        </div>
        <div className="flex shrink-0 items-end">
          {out ? null : qty > 0 ? (
            <Stepper value={qty} onChange={(v) => cart.set(sku.id, v)} max={sku.stock_cases} label={`${sku.name} ${t("cases")}`} />
          ) : (
            <Button variant="secondary" onClick={() => cart.set(sku.id, 1, "CASE")} aria-label={`${t("add")} ${sku.name}`}>{t("add")}</Button>
          )}
        </div>
      </Card>
    </li>
  );
}
