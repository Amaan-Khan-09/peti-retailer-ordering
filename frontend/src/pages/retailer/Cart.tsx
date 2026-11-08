import { Check, Clock, CloudOff, Gift, Lightbulb, MessageCircle, PartyPopper, ShoppingCart, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api";
import { useAuth } from "../../auth";
import { useCart, type CartItem } from "../../cart";
import { rupee } from "../../format";
import { useLang } from "../../i18n";
import { quoteOrder } from "../../offline/pricing";
import { newRef, queueOrder, useOffline } from "../../offline/store";
import type { Bundle, BundleShop, Order, Quote, QuoteLine, Unit } from "../../types";
import { Button, Card, EmptyState, Meter, Skeleton, Stepper, cx, haptic } from "../../ui";
import ProductTile from "./ProductTile";

export function useQuote(lines: { sku_id: number; qty: number; unit: Unit }[], retailerId?: number) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify([lines, retailerId]);
  useEffect(() => {
    if (!lines.length) { setQuote(null); return; }
    let live = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api.post<Quote>("/api/quote", { lines, retailer_id: retailerId })
        .then((q) => { if (live) { setQuote(q); setError(null); } })
        .catch((e: ApiError) => { if (live) setError(e.message); })
        .finally(() => { if (live) setLoading(false); });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { quote, error, loading };
}

/** The same scheme engine, run on the phone from the day's bundle; works without signal. */
export function localQuote(items: CartItem[], bundle: Bundle, shop: BundleShop): Quote {
  const skus = new Map(bundle.skus.map((s) => [s.id, s]));
  const known = items.filter((i) => skus.has(i.sku_id));
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const result = quoteOrder(known.map((i) => {
    const s = skus.get(i.sku_id)!;
    return { item: { code: s.code, units_per_case: s.units_per_case, unit_price: shop.prices[String(s.id)] ?? s.dealer_price, gst_rate: s.gst_rate, stock_cases: s.stock_cases, schemes: s.schemes }, qty: i.qty, unit: i.unit };
  }), today);
  return {
    ...result,
    lines: result.lines.map((l, index) => {
      const s = skus.get(known[index].sku_id)!;
      return { ...l, sku_id: s.id, name: s.name, name_hi: s.name_hi, pack: s.pack, units_per_case: s.units_per_case, gst_rate: s.gst_rate };
    }),
  };
}

/** What the schemes are worth on this order: slab discounts plus the value of free cases at the shop's price. */
const savings = (quote: Quote) =>
  quote.discount_total + quote.lines.reduce((s, l) => s + l.free_cases * l.units_per_case * l.unit_price, 0);

export function Totals({ quote }: { quote: Pick<Quote, "subtotal" | "discount_total" | "free_cases_total" | "gst_total" | "total"> }) {
  const { t } = useLang();
  return (
    <dl className="num space-y-2.5 text-sm">
      <div className="flex justify-between"><dt className="text-muted">{t("subtotal")} ({t("exclGst")})</dt><dd className="font-medium">{rupee(quote.subtotal)}</dd></div>
      {quote.discount_total > 0 && <div className="flex justify-between font-medium text-accent"><dt>{t("schemeDiscount")}</dt><dd>−{rupee(quote.discount_total)}</dd></div>}
      {quote.free_cases_total > 0 && <div className="flex justify-between font-medium text-accent"><dt>{t("free")}</dt><dd>{quote.free_cases_total} {quote.free_cases_total === 1 ? t("perCase") : t("cases")}</dd></div>}
      <div className="flex justify-between"><dt className="text-muted">{t("gst")}</dt><dd className="font-medium">{rupee(quote.gst_total)}</dd></div>
      <div className="flex items-baseline justify-between border-t border-dashed border-line pt-3"><dt className="font-semibold">{t("total")}</dt><dd className="text-xl font-extrabold">{rupee(quote.total)}</dd></div>
    </dl>
  );
}

type Placed = { kind: "order"; order: Order } | { kind: "queued"; ref: string; total: number };

function Success({ tone, icon, title, children }: { tone: "ok" | "wait"; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="relative mx-auto max-w-md overflow-hidden p-8 text-center">
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-32", tone === "ok" ? "bg-gradient-to-b from-accent-soft to-transparent" : "bg-gradient-to-b from-warn-soft to-transparent")} aria-hidden />
      <div className="relative mx-auto mb-5 grid size-20 animate-pop place-items-center">
        <span className={cx("absolute inset-0 rounded-full", tone === "ok" ? "bg-accent/15" : "bg-warn/15")} />
        <span className={cx("relative grid size-14 place-items-center rounded-full text-white", tone === "ok" ? "bg-accent shadow-glow" : "bg-warn")}>{icon}</span>
      </div>
      <div className="relative">
        <h1 className="text-2xl font-bold">{title}</h1>
        {children}
      </div>
    </Card>
  );
}

/** Retailer cart (priced by the server) or salesman cart for a shop visit (priced on the phone, sent when online). */
export default function Cart({ salesman }: { salesman?: { shop: BundleShop; bundle: Bundle; ordersTo: string; shopTo: string } }) {
  const { t } = useLang();
  const { me, refresh } = useAuth();
  const cart = useCart();
  const offline = useOffline();
  const server = useQuote(salesman ? [] : cart.items);
  const local = useMemo(() => (salesman ? localQuote(cart.items, salesman.bundle, salesman.shop) : null), [salesman, cart.items]);
  const quote = salesman ? local : server.quote;
  const loading = salesman ? false : server.loading;
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<{ message: string; details: string[] } | null>(null);
  const [placed, setPlaced] = useState<Placed | null>(null);
  const submission = useRef(newRef()); // one key per cart submission: a retried request returns the same order

  const pendingForShop = salesman ? offline.outbox.filter((e) => e.retailer_id === salesman.shop.id && e.status === "pending").reduce((s, e) => s + e.estimate, 0) : 0;
  const available = salesman ? Math.max(salesman.shop.credit_available - pendingForShop, 0) : me?.retailer?.credit_available ?? 0;
  const overCredit = quote ? quote.total > available : false;
  const saved = quote ? savings(quote) : 0;

  async function place() {
    haptic();
    setPlaceError(null);
    if (salesman) {
      queueOrder({ client_ref: submission.current, retailer_id: salesman.shop.id, shop_name: salesman.shop.shop_name, lines: cart.items, note: note.trim() || null, estimate: quote!.total });
      setPlaced({ kind: "queued", ref: submission.current, total: quote!.total });
      submission.current = newRef();
      cart.clear();
      return;
    }
    setPlacing(true);
    try {
      const order = await api.post<Order>("/api/orders", { lines: cart.items, note: note.trim() || null, client_ref: submission.current });
      setPlaced({ kind: "order", order });
      submission.current = newRef();
      cart.clear();
      refresh();
    } catch (e) {
      const err = e as ApiError;
      setPlaceError({ message: err.message, details: err.details });
    } finally {
      setPlacing(false);
    }
  }

  if (placed?.kind === "queued") {
    const entry = offline.outbox.find((e) => e.client_ref === placed.ref);
    const sent = entry?.status === "sent";
    return (
      <Success tone={sent ? "ok" : "wait"} icon={sent ? <Check className="size-7" strokeWidth={3} aria-hidden /> : <CloudOff className="size-7" aria-hidden />}
        title={sent ? `Sent as ${entry!.order!.number}` : entry?.status === "failed" ? "Needs attention" : "Saved on this phone"}>
        <p className="num mt-2 text-muted">{salesman!.shop.shop_name} · <span className="font-semibold text-ink">{rupee(sent ? entry!.order!.total : placed.total)}</span>{sent ? "" : " (estimate)"}</p>
        <p className="mt-3 text-sm text-muted">
          {sent ? (entry!.order!.status === "CREDIT_HOLD" ? "It is on credit hold; the desk will call the shop." : "The desk will confirm it.")
            : entry?.status === "failed" ? entry.error : "It will be sent as soon as there is signal. You can carry on with the next shop."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to={salesman!.ordersTo}><Button variant="secondary">Outbox</Button></Link>
          <Link to="/s"><Button>Next shop</Button></Link>
        </div>
      </Success>
    );
  }

  if (placed?.kind === "order") {
    const hold = placed.order.status === "CREDIT_HOLD";
    return (
      <Success tone={hold ? "wait" : "ok"} icon={hold ? <Clock className="size-7" aria-hidden /> : <Check className="size-7" strokeWidth={3} aria-hidden />}
        title={hold ? t("onHold") : t("orderPlaced")}>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-canvas px-3 py-1 text-sm">
          <span className="num font-bold">{placed.order.number}</span><span className="text-faint">·</span><span className="num font-semibold">{rupee(placed.order.total)}</span>
        </p>
        <p className="mt-3 text-sm text-muted">{hold ? placed.order.hold_reason : t("placedBody")}</p>
        {placed.order.free_cases_total > 0 && <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-3 py-1 text-sm font-semibold text-gold"><Gift className="size-4" aria-hidden />{t("freeCases", { n: placed.order.free_cases_total, unit: placed.order.free_cases_total === 1 ? t("perCase") : t("cases") })}</p>}
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted"><MessageCircle className="size-3.5 text-[#25a35a]" aria-hidden />{t("whatsapp")}</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to={`/orders/${placed.order.id}`}><Button variant="secondary">{t("orders")}</Button></Link>
          <Link to="/"><Button>{t("keepShopping")}</Button></Link>
        </div>
      </Success>
    );
  }

  if (!cart.items.length) {
    return <EmptyState icon={ShoppingCart} title={t("emptyCart")} body={t("emptyCartBody")} action={<Link to={salesman?.shopTo ?? "/"}><Button>{t("goShop")}</Button></Link>} />;
  }

  return (
    <div className="grid gap-5 pb-28 md:grid-cols-[1fr_320px] md:pb-0">
      <section aria-label={t("cart")}>
        <h1 className="mb-1 text-2xl font-bold">{t("cart")}{salesman ? ` · ${salesman.shop.shop_name}` : ""}</h1>
        <p className="mb-4 text-sm text-muted">{cart.items.length} {t("items")}</p>
        {saved > 0 && (
          <div className="mb-3 flex animate-rise items-center gap-3 rounded-2xl bg-gradient-to-r from-accent to-[#14935a] px-4 py-3 text-white shadow-glow">
            <PartyPopper className="size-6 shrink-0 text-[#ffd77a]" aria-hidden />
            <div className="leading-tight">
              <p className="num font-bold">{t("youSave", { amount: rupee(saved) })}</p>
              <p className="text-xs text-white/75">{t("saveBreakdown")}</p>
            </div>
          </div>
        )}
        {!quote && loading ? <Skeleton rows={cart.items.length} /> : server.error && !salesman ? <p role="alert" className="text-danger">{server.error}</p> : (
          <ul className="space-y-3">
            {quote?.lines.map((line) => <CartRow key={line.sku_id} line={line} />)}
          </ul>
        )}
      </section>
      <aside className="md:sticky md:top-24 md:self-start">
        <Card className={cx("p-5 transition-opacity", loading && "opacity-60")}>
          <h2 className="mb-4 text-sm font-bold tracking-wide text-muted uppercase">{t("orderSummary")}</h2>
          {quote ? <Totals quote={quote} /> : <Skeleton rows={2} />}
          {salesman && <p className="mt-3 text-xs text-muted">Priced on this phone from today's prices and schemes{offline.online ? "" : " (no signal)"}. The desk's system re-checks it when it is sent.</p>}
          {overCredit && <p className="mt-4 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{t("overCredit", { amount: rupee(available) })}</p>}
          <label htmlFor="note" className="mt-5 block text-sm font-medium text-muted">{t("note")}</label>
          <textarea id="note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="mt-1 w-full rounded-xl border border-line bg-canvas/60 p-3 text-sm outline-none focus:border-accent focus:bg-surface" />
          {placeError && (
            <div role="alert" className="mt-3 text-sm text-danger">
              <p>{placeError.message}</p>
              {placeError.details.map((d) => <p key={d}>• {d}</p>)}
            </div>
          )}
          <div className="fixed inset-x-3 bottom-[76px] z-30 mx-auto max-w-3xl rounded-2xl bg-surface/95 p-2 shadow-lift ring-1 ring-ink/[0.06] backdrop-blur-xl md:static md:mt-4 md:bg-transparent md:p-0 md:shadow-none md:ring-0">
            <Button size="lg" className="h-14 w-full text-base" onClick={place} loading={placing} disabled={!quote || loading || quote.errors.length > 0}>
              {salesman && !offline.online ? "Save order" : t("placeOrder")} {quote && !loading ? `· ${rupee(quote.total)}` : ""}
            </Button>
          </div>
        </Card>
      </aside>
    </div>
  );
}

function CartRow({ line }: { line: QuoteLine }) {
  const { t, name, hint } = useLang();
  const cart = useCart();
  const need = line.hint_data?.need ?? 0;
  return (
    <li className="animate-rise">
      <Card className={cx("p-4", line.errors.length > 0 && "border-danger ring-1 ring-danger/30")}>
        <div className="flex items-start gap-3">
          <ProductTile code={line.code} pack={line.pack} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="leading-snug font-bold">{name(line)}</p>
            <p className="num text-xs text-muted">{rupee(line.unit_price)}/{t("perPiece")} · {line.units_per_case} {t("pieces")}/{t("perCase")} · GST {line.gst_rate}%</p>
          </div>
          <p className="num font-bold">{rupee(line.total)}</p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Stepper value={line.qty} onChange={(v) => cart.set(line.sku_id, v)} label={`${line.name} quantity`} />
          <div className="inline-flex h-11 rounded-xl bg-ink/[0.05] p-1" role="radiogroup" aria-label="Unit">
            {(["CASE", "PIECE"] as Unit[]).map((u) => (
              <button key={u} role="radio" aria-checked={line.unit === u} onClick={() => cart.set(line.sku_id, line.qty, u)}
                className={cx("rounded-lg px-2.5 text-sm font-semibold transition-all", line.unit === u ? "bg-surface text-accent shadow-card" : "text-muted")}>
                {u === "CASE" ? t("cases") : t("pieces")}
              </button>
            ))}
          </div>
          <button onClick={() => cart.set(line.sku_id, 0)} className="ml-auto grid size-10 shrink-0 place-items-center rounded-xl text-faint transition-colors hover:bg-danger-soft hover:text-danger" aria-label={`${t("remove")} ${line.name}`}>
            <Trash2 className="size-[18px]" />
          </button>
        </div>
        {(line.free_cases > 0 || line.discount_pct > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {line.free_cases > 0 && <p className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-2.5 py-1 text-xs font-bold text-gold"><Gift className="size-3.5" aria-hidden />{t("freeCases", { n: line.free_cases, unit: line.free_cases === 1 ? t("perCase") : t("cases") })}</p>}
            {line.discount_pct > 0 && <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent"><Check className="size-3.5" aria-hidden />{t("pctOff", { pct: line.discount_pct })}</p>}
          </div>
        )}
        {line.free_earned > line.free_cases && <p className="mt-2 text-sm text-warn">{t("freeCapped", { earned: line.free_earned, given: line.free_cases })}</p>}
        {line.hint_data && (
          <button onClick={() => { haptic(); cart.set(line.sku_id, line.qty + need); }}
            className="mt-3 w-full rounded-xl border border-dashed border-gold/40 bg-gold-soft/60 px-3 py-2.5 text-left text-sm text-[#8a5a12] transition-colors hover:bg-gold-soft">
            <span className="flex items-center gap-2 font-semibold"><Lightbulb className="size-4 shrink-0 text-gold" aria-hidden />{hint(line.hint_data)}<span className="ml-auto rounded-lg bg-gold px-2 py-0.5 text-xs font-bold text-white">+{need}</span></span>
            {line.unit === "CASE" && <>
              <Meter value={(100 * line.qty) / (line.qty + need)} tone="gold" className="mt-2" />
              <span className="num mt-1 block text-xs text-[#8a5a12]/80">{t("schemeProgress", { have: line.qty, need: line.qty + need })}</span>
            </>}
          </button>
        )}
        {line.errors.map((e) => <p key={e} role="alert" className="mt-2 text-sm text-danger">{e}</p>)}
      </Card>
    </li>
  );
}
