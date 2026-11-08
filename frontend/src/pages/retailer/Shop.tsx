import { ChevronRight, Coffee, Cookie, Droplets, Gift, LayoutGrid, PackageSearch, Plus, RotateCcw, Search, Sparkles, WashingMachine, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../auth";
import { useCart } from "../../cart";
import { margin, rupee, rupeeShort } from "../../format";
import { useLang } from "../../i18n";
import type { Sku, Suggestion, Unit } from "../../types";
import { Badge, Button, Card, EmptyState, ErrorState, Meter, Skeleton, Stepper, cx, haptic, useAsync, useToast } from "../../ui";
import ProductTile from "./ProductTile";

export interface ShopViewProps {
  items: Sku[]; loading: boolean; error?: string; reload: () => void; suggestions: Suggestion[];
  repeat?: { order_number: string | null; lines: { sku_id: number; qty: number; unit: Unit }[] } | null;
  cartTo: string; header?: ReactNode;
}

const CATEGORY_ICON: Record<string, typeof Cookie> = { Biscuits: Cookie, "Home care": WashingMachine, Tea: Coffee, "Personal care": Droplets };

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
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const estimate = cart.items.reduce((sum, l) => {
    const sku = byId.get(l.sku_id);
    return sku ? sum + l.qty * (l.unit === "CASE" ? sku.case_price : sku.price) : sum;
  }, 0);

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
    <div className="pb-20">
      {header}
      {items.length > 0 && (suggestions.length > 0 || repeat?.order_number) && (
        <UsualOrder suggestions={suggestions} byId={byId} onRepeat={repeat?.order_number ? repeatLast : undefined} />
      )}

      <div className="sticky top-[var(--header-h,4rem)] z-20 -mx-4 bg-canvas/90 px-4 pt-2 pb-3 backdrop-blur-md">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-faint" aria-hidden />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} aria-label={t("search")}
            className="h-12 w-full rounded-2xl border border-ink/[0.06] bg-surface pr-10 pl-12 shadow-card outline-none transition-shadow placeholder:text-faint focus:border-accent/50 focus:shadow-[0_0_0_4px_rgb(15_122_69/0.12)] [&::-webkit-search-cancel-button]:hidden" />
          {query && <button onClick={() => setQuery("")} className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-ink/5 text-muted" aria-label="Clear search"><X className="size-4" /></button>}
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Categories">
          {[null, ...categories].map((c) => {
            const Icon = c ? CATEGORY_ICON[c] ?? LayoutGrid : LayoutGrid;
            const active = category === c;
            return (
              <button key={c ?? "all"} role="tab" aria-selected={active} onClick={() => setCategory(c)}
                className={cx("flex h-11 shrink-0 items-center gap-1.5 rounded-full border pr-4 pl-3 text-sm font-semibold transition-all active:scale-95",
                  active ? "border-transparent bg-ink text-white shadow-lift" : "border-ink/[0.06] bg-surface text-muted shadow-card hover:text-ink")}>
                <Icon className={cx("size-4", active ? "text-[#7ee2ad]" : "text-faint")} aria-hidden />
                {c ? categoryName(c) : t("all")}
              </button>
            );
          })}
        </div>
      </div>

      {loading && !items.length ? <Skeleton rows={6} className="mt-2" /> : shown.length === 0 ? (
        <EmptyState icon={PackageSearch} title={t("noResults")} action={<Button variant="secondary" onClick={() => { setQuery(""); setCategory(null); }}>{t("all")}</Button>} />
      ) : (
        <>
          <p className="mb-2 text-xs font-semibold tracking-wide text-faint uppercase">{t("productsCount", { n: shown.length })}</p>
          <ul className="grid gap-3 md:grid-cols-2">
            {shown.map((sku, i) => <ProductRow key={sku.id} sku={sku} index={i} />)}
          </ul>
        </>
      )}

      {cart.items.length > 0 && (
        <Link to={cartTo} className="fixed inset-x-3 bottom-[76px] z-30 mx-auto flex h-16 max-w-3xl animate-rise items-center gap-3 rounded-2xl bg-gradient-to-r from-accent to-accent-strong pr-4 pl-3 text-white shadow-glow transition-transform active:scale-[0.98] md:bottom-6">
          <span className="num grid size-10 place-items-center rounded-xl bg-white/15 text-base font-bold" key={cart.items.length}>
            <span className="animate-pop">{cart.items.length}</span>
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block text-xs font-medium text-white/75">{cart.items.length} {t("items")}</span>
            <span className="num block font-bold">{rupee(estimate)} <span className="text-xs font-medium text-white/75">+ GST</span></span>
          </span>
          <span className="flex items-center gap-1 font-bold">{t("viewCart")}<ChevronRight className="size-5" aria-hidden /></span>
        </Link>
      )}
    </div>
  );
}

function UsualOrder({ suggestions, byId, onRepeat }: { suggestions: Suggestion[]; byId: Map<number, Sku>; onRepeat?: () => void }) {
  const { t, name } = useLang();
  const cart = useCart();
  const toast = useToast();
  const rows = suggestions.filter((s) => byId.has(s.sku_id));
  const due = rows.filter((s) => s.due_in_days <= 0 && s.in_stock);
  const addable = due.length ? due : rows.filter((s) => s.in_stock);
  const addAll = () => {
    haptic();
    addable.forEach((s) => cart.set(s.sku_id, Math.max(cart.qtyOf(s.sku_id), s.qty), "CASE"));
    toast(t("added"));
  };
  return (
    <Card className="mb-4 overflow-hidden">
      <div className="flex items-start gap-3 bg-gradient-to-br from-gold-soft via-[#fffaf0] to-surface px-4 pt-4 pb-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#f2c14e] to-gold text-white shadow-[0_4px_12px_-4px_rgb(183_121_31/0.6)]"><Sparkles className="size-5" aria-hidden /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold tracking-wider text-gold uppercase">{t("smart")}</p>
          <p className="text-[17px] leading-tight font-bold">{t("usual")}</p>
          <p className="mt-0.5 text-sm text-muted">{t("usualBody")}</p>
        </div>
      </div>
      {rows.length > 0 && (
        <ul className="divide-y divide-line px-4">
          {rows.map((s) => {
            const sku = byId.get(s.sku_id)!;
            const inCart = cart.qtyOf(s.sku_id) > 0;
            return (
              <li key={s.sku_id} className="flex items-center gap-3 py-2.5">
                <ProductTile code={sku.code} pack={sku.pack} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className={cx("truncate text-[15px] font-semibold", !s.in_stock && "text-faint line-through")}>{name(sku)}</p>
                  <p className="text-xs text-muted">{s.qty} {s.qty === 1 ? t("perCase") : t("cases")} · {t("every", { n: s.every_days })}</p>
                </div>
                {!s.in_stock ? <Badge tone="red">{t("outOfStock")}</Badge> : s.due_in_days <= 0 ? <Badge tone="amber">{t("dueNow")}</Badge> : <Badge>{s.due_in_days === 1 ? t("dueTomorrow") : t("dueIn", { n: s.due_in_days })}</Badge>}
                <button disabled={!s.in_stock || inCart} onClick={() => { haptic(); cart.set(s.sku_id, s.qty, "CASE"); }} aria-label={`${t("add")} ${s.qty} ${s.qty === 1 ? t("perCase") : t("cases")} ${sku.name}`}
                  className={cx("grid size-11 shrink-0 place-items-center rounded-xl border text-sm font-bold transition-all active:scale-90",
                    inCart ? "border-transparent bg-accent text-white" : "border-accent/30 bg-accent-soft text-accent disabled:border-line disabled:bg-canvas disabled:text-faint")}>
                  {inCart ? "✓" : <Plus className="size-4" strokeWidth={2.5} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap gap-2 border-t border-line bg-canvas/50 px-4 py-3">
        {addable.length > 0 && <Button onClick={addAll}>{due.length ? t("addDue", { n: due.length }) : t("addAll")}</Button>}
        {onRepeat && <Button variant="ghost" onClick={onRepeat}><RotateCcw className="size-4" aria-hidden />{t("repeat")}</Button>}
      </div>
    </Card>
  );
}

function ProductRow({ sku, index }: { sku: Sku; index: number }) {
  const { t, name, scheme } = useLang();
  const cart = useCart();
  const qty = cart.qtyOf(sku.id);
  const out = sku.stock_status === "OUT";
  const m = margin(sku);
  return (
    <li className="animate-rise" style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}>
      <Card className={cx("flex h-full gap-3.5 p-3 transition-shadow hover:shadow-lift", qty > 0 && "ring-2 ring-accent/25", out && "opacity-75")}>
        <div className={cx(out && "grayscale")}><ProductTile code={sku.code} pack={sku.pack} /></div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="leading-snug font-bold">{name(sku)}</p>
          <p className="text-xs text-muted">{sku.brand.replace(/ \(.*\)/, "")} · 1 {t("perCase")} = {sku.units_per_case} {t("pieces")}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {sku.schemes.map((s) => <Badge key={s.label} tone="gold"><Gift className="size-3" aria-hidden />{scheme(s)}</Badge>)}
            {sku.stock_status === "LOW" && <Badge tone="amber">{t("lowStock", { n: sku.stock_cases })}</Badge>}
            {out && <Badge tone="red">{t("outOfStock")}</Badge>}
          </div>
          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <div className="min-w-0 leading-tight">
              <p><span className="num text-[17px] font-extrabold">{rupee(sku.case_price)}</span><span className="text-xs text-muted">/{t("perCase")}</span> <span className="rounded bg-ink/[0.06] px-1 text-[10px] font-bold text-muted">+GST</span></p>
              <p className="num text-xs text-muted">{rupee(sku.price)}/{t("perPiece")} · {t("exclGst")}</p>
              {m && <p className="num mt-0.5 text-xs"><span className="text-faint">MRP {rupeeShort(sku.mrp)}</span> · <span className="font-semibold text-accent">{t("margin", { pct: m.pct })}</span></p>}
            </div>
            {out ? null : qty > 0 ? (
              <Stepper solid value={qty} onChange={(v) => cart.set(sku.id, v)} max={sku.stock_cases} label={`${sku.name} ${t("cases")}`} />
            ) : (
              <button onClick={() => { haptic(); cart.set(sku.id, 1, "CASE"); }} aria-label={`${t("add")} ${sku.name}`}
                className="flex h-11 shrink-0 items-center gap-1 rounded-xl border-[1.5px] border-accent bg-accent-soft/60 px-4 text-sm font-extrabold tracking-wide text-accent uppercase shadow-card transition-all hover:bg-accent hover:text-white active:scale-95">
                {t("add")}<Plus className="size-4" strokeWidth={3} aria-hidden />
              </button>
            )}
          </div>
        </div>
      </Card>
    </li>
  );
}

function RetailerHero({ items, dueCount }: { items: Sku[]; dueCount: number }) {
  const { me } = useAuth();
  const { t } = useLang();
  const shop = me!.retailer!;
  const usedPct = shop.credit_limit > 0 ? (100 * shop.credit_used) / shop.credit_limit : 0;
  const offers = items.filter((i) => i.schemes.length > 0).length;
  return (
    <section className="hero relative mb-4 overflow-hidden rounded-3xl p-5 text-white shadow-lift" aria-label={t("availableCredit")}>
      <p className="text-sm text-white/70">{t("hello")}, {me!.name.split(" ")[0]} ji</p>
      <p className="text-xl font-bold">{shop.shop_name}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-white/65 uppercase">{t("availableCredit")}</p>
          <p className="num text-[28px] leading-tight font-extrabold">{rupeeShort(shop.credit_available)}</p>
        </div>
        <p className="num pb-1 text-right text-xs text-white/65">{t("ofLimit", { limit: rupeeShort(shop.credit_limit) })}</p>
      </div>
      <Meter value={100 - usedPct} tone="light" className="mt-2" />
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        {offers > 0 && <span className="flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1 ring-1 ring-white/15"><Gift className="size-3.5 text-[#ffd77a]" aria-hidden />{t("liveSchemes", { n: offers })}</span>}
        {dueCount > 0 && <span className="flex items-center gap-1 rounded-full bg-white/12 px-2.5 py-1 ring-1 ring-white/15"><Sparkles className="size-3.5 text-[#ffd77a]" aria-hidden />{t("dueCount", { n: dueCount })}</span>}
      </div>
    </section>
  );
}

export default function Shop() {
  const catalogue = useAsync(() => api.get<{ items: Sku[] }>("/api/catalogue"));
  const suggestions = useAsync(() => api.get<{ items: Suggestion[] }>("/api/suggestions"));
  const repeat = useAsync(() => api.get<{ order_number: string | null; lines: { sku_id: number; qty: number; unit: Unit }[] }>("/api/orders/repeat"));
  const items = catalogue.data?.items ?? [];
  const suggested = suggestions.data?.items ?? [];
  return (
    <ShopView items={items} loading={catalogue.loading} error={catalogue.error} reload={catalogue.reload}
      suggestions={suggested} repeat={repeat.data} cartTo="/cart"
      header={<RetailerHero items={items} dueCount={suggested.filter((s) => s.due_in_days <= 0 && s.in_stock).length} />} />
  );
}
