import { CalendarClock, Gift, PackageSearch, RotateCcw, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useCart } from "../../cart";
import { rupee } from "../../format";
import { useLang } from "../../i18n";
import type { Sku, Suggestion, Unit } from "../../types";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton, Stepper, cx, useAsync, useToast } from "../../ui";
import ProductTile from "./ProductTile";

export interface ShopViewProps {
  items: Sku[]; loading: boolean; error?: string; reload: () => void; suggestions: Suggestion[];
  repeat?: { order_number: string | null; lines: { sku_id: number; qty: number; unit: Unit }[] } | null;
  cartTo: string; header?: ReactNode;
}

/** The catalogue, shared by the retailer app and the salesman's shop visit. */
export function ShopView({ items, loading, error, reload, suggestions, repeat, cartTo, header }: ShopViewProps) {
  const { t, category: categoryName } = useLang();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const categories = useMemo(() => [...new Set(items.map((i) => i.category))], [items]);
  const shown = items.filter((i) => (!category || i.category === category) &&
    (!query || `${i.name} ${i.name_hi} ${i.brand} ${i.code}`.toLowerCase().includes(query.trim().toLowerCase())));

  function repeatLast() {
    const inStock = new Set(items.filter((i) => i.stock_status !== "OUT").map((i) => i.id));
    const lines = repeat!.lines.filter((l) => inStock.has(l.sku_id));
    const skipped = repeat!.lines.length - lines.length;
    cart.replace(lines);
    if (skipped) toast(`${skipped} item${skipped > 1 ? "s are" : " is"} out of stock and left out`);
    navigate(cartTo);
  }

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div>
      {header}
      {items.length > 0 && (suggestions.length > 0 || repeat?.order_number) && (
        <UsualOrder suggestions={suggestions} items={items} onRepeat={repeat?.order_number ? repeatLast : undefined} />
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
            {c ? categoryName(c) : t("all")}
          </button>
        ))}
      </div>

      {loading && !items.length ? <Skeleton rows={6} className="mt-5" /> : shown.length === 0 ? (
        <EmptyState icon={PackageSearch} title={t("noResults")} action={<Button variant="secondary" onClick={() => { setQuery(""); setCategory(null); }}>{t("all")}</Button>} />
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((sku) => <ProductRow key={sku.id} sku={sku} />)}
        </ul>
      )}

      {cart.items.length > 0 && (
        <Link to={cartTo} className="fixed inset-x-4 bottom-20 z-20 mx-auto flex h-14 max-w-3xl items-center justify-between rounded-2xl bg-ink px-5 text-white shadow-lg md:bottom-6">
          <span className="font-medium">{cart.items.length} {t("items")}</span>
          <span className="font-semibold">{t("viewCart")} →</span>
        </Link>
      )}
    </div>
  );
}

function UsualOrder({ suggestions, items, onRepeat }: { suggestions: Suggestion[]; items: Sku[]; onRepeat?: () => void }) {
  const { t, name } = useLang();
  const cart = useCart();
  const toast = useToast();
  const byId = new Map(items.map((i) => [i.id, i]));
  const rows = suggestions.filter((s) => byId.has(s.sku_id));
  const due = rows.filter((s) => s.due_in_days <= 0 && s.in_stock);
  const addable = due.length ? due : rows.filter((s) => s.in_stock);
  const addAll = () => {
    addable.forEach((s) => cart.set(s.sku_id, Math.max(cart.qtyOf(s.sku_id), s.qty), "CASE"));
    toast(t("added"));
  };
  return (
    <Card className="mb-5 p-4">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><CalendarClock className="size-5" aria-hidden /></div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t("usual")}</p>
          <p className="text-sm text-muted">{t("usualBody")}</p>
        </div>
      </div>
      {rows.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {rows.map((s) => {
            const sku = byId.get(s.sku_id)!;
            const inCart = cart.qtyOf(s.sku_id) > 0;
            return (
              <li key={s.sku_id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className={cx("truncate text-[15px] font-medium", !s.in_stock && "text-faint line-through")}>{name(sku)}</p>
                  <p className="text-xs text-muted">{s.qty} {s.qty === 1 ? t("perCase") : t("cases")} · {t("every", { n: s.every_days })}</p>
                </div>
                {!s.in_stock ? <Badge tone="red">{t("outOfStock")}</Badge> : s.due_in_days <= 0 ? <Badge tone="amber">{t("dueNow")}</Badge> : <Badge>{t("dueIn", { n: s.due_in_days })}</Badge>}
                <Button size="sm" variant="secondary" disabled={!s.in_stock || inCart} onClick={() => cart.set(s.sku_id, s.qty, "CASE")}
                  aria-label={`${t("add")} ${sku.name}`}>{inCart ? "✓" : "+"}</Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {addable.length > 0 && <Button onClick={addAll}>{due.length ? t("addDue", { n: due.length }) : t("addAll")}</Button>}
        {onRepeat && <Button variant="ghost" onClick={onRepeat}><RotateCcw className="size-4" aria-hidden />{t("repeat")}</Button>}
      </div>
    </Card>
  );
}

function ProductRow({ sku }: { sku: Sku }) {
  const { t, name, scheme } = useLang();
  const cart = useCart();
  const qty = cart.qtyOf(sku.id);
  const out = sku.stock_status === "OUT";
  return (
    <li>
      <Card className={cx("flex gap-4 p-3", out && "opacity-70")}>
        <ProductTile category={sku.category} pack={sku.pack} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{name(sku)}</p>
          <p className="text-xs text-muted">{sku.brand.replace(/ \(.*\)/, "")} · 1 {t("perCase")} = {sku.units_per_case} {t("pieces")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sku.schemes.map((s) => <Badge key={s.label} tone="green"><Gift className="size-3" aria-hidden />{scheme(s)}</Badge>)}
            {sku.stock_status === "LOW" && <Badge tone="amber">{t("lowStock", { n: sku.stock_cases })}</Badge>}
            {out && <Badge tone="red">{t("outOfStock")}</Badge>}
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <p className="leading-tight">
              <span className="num font-semibold">{rupee(sku.case_price)}</span><span className="text-sm text-muted">/{t("perCase")}</span>
              <span className="num block text-xs text-muted">{rupee(sku.price)}/{t("perPiece")} · {t("exclGst")}</span>
            </p>
            {out ? null : qty > 0 ? (
              <Stepper value={qty} onChange={(v) => cart.set(sku.id, v)} max={sku.stock_cases} label={`${sku.name} ${t("cases")}`} />
            ) : (
              <Button variant="secondary" onClick={() => cart.set(sku.id, 1, "CASE")} aria-label={`${t("add")} ${sku.name}`}>{t("add")}</Button>
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}

export default function Shop() {
  const catalogue = useAsync(() => api.get<{ items: Sku[] }>("/api/catalogue"));
  const suggestions = useAsync(() => api.get<{ items: Suggestion[] }>("/api/suggestions"));
  const repeat = useAsync(() => api.get<{ order_number: string | null; lines: { sku_id: number; qty: number; unit: Unit }[] }>("/api/orders/repeat"));
  return (
    <ShopView items={catalogue.data?.items ?? []} loading={catalogue.loading} error={catalogue.error} reload={catalogue.reload}
      suggestions={suggestions.data?.items ?? []} repeat={repeat.data} cartTo="/cart" />
  );
}
