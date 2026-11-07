import { CheckCircle2, Clock, CloudOff, Gift, Lightbulb, ShoppingCart, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api";
import { useAuth } from "../../auth";
import { useCart, type CartItem } from "../../cart";
import { rupee } from "../../format";
import { useLang } from "../../i18n";
import { quoteOrder } from "../../offline/pricing";
import { newRef, queueOrder, useOffline } from "../../offline/store";
import type { Bundle, BundleShop, Order, Quote, QuoteLine, Unit } from "../../types";
import { Button, Card, EmptyState, Skeleton, Stepper, cx } from "../../ui";

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

export function Totals({ quote }: { quote: Pick<Quote, "subtotal" | "discount_total" | "free_cases_total" | "gst_total" | "total"> }) {
  const { t } = useLang();
  return (
    <dl className="num space-y-2 text-sm">
      <div className="flex justify-between"><dt className="text-muted">{t("subtotal")} ({t("exclGst")})</dt><dd>{rupee(quote.subtotal)}</dd></div>
      {quote.discount_total > 0 && <div className="flex justify-between text-accent"><dt>{t("schemeDiscount")}</dt><dd>−{rupee(quote.discount_total)}</dd></div>}
      {quote.free_cases_total > 0 && <div className="flex justify-between text-accent"><dt>{t("free")}</dt><dd>{quote.free_cases_total} {quote.free_cases_total === 1 ? t("perCase") : t("cases")}</dd></div>}
      <div className="flex justify-between"><dt className="text-muted">{t("gst")}</dt><dd>{rupee(quote.gst_total)}</dd></div>
      <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>{t("total")}</dt><dd>{rupee(quote.total)}</dd></div>
    </dl>
  );
}

type Placed = { kind: "order"; order: Order } | { kind: "queued"; ref: string; total: number };

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

  async function place() {
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
      <Card className="mx-auto max-w-md p-8 text-center">
        <div className={cx("mx-auto mb-4 grid size-14 place-items-center rounded-2xl", sent ? "bg-accent-soft text-accent" : "bg-warn-soft text-warn")}>
          {sent ? <CheckCircle2 className="size-7" aria-hidden /> : <CloudOff className="size-7" aria-hidden />}
        </div>
        <h1 className="text-xl font-semibold">{sent ? `Sent as ${entry!.order!.number}` : entry?.status === "failed" ? "Needs attention" : "Saved on this phone"}</h1>
        <p className="num mt-2 text-muted">{salesman!.shop.shop_name} · {rupee(sent ? entry!.order!.total : placed.total)}{sent ? "" : " (estimate)"}</p>
        <p className="mt-3 text-sm text-muted">
          {sent ? (entry!.order!.status === "CREDIT_HOLD" ? "It is on credit hold; the desk will call the shop." : "The desk will confirm it.")
            : entry?.status === "failed" ? entry.error : "It will be sent as soon as there is signal. You can carry on with the next shop."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to={salesman!.ordersTo}><Button variant="secondary">Outbox</Button></Link>
          <Link to="/s"><Button>Next shop</Button></Link>
        </div>
      </Card>
    );
  }

  if (placed?.kind === "order") {
    const hold = placed.order.status === "CREDIT_HOLD";
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <div className={cx("mx-auto mb-4 grid size-14 place-items-center rounded-2xl", hold ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent")}>
          {hold ? <Clock className="size-7" aria-hidden /> : <CheckCircle2 className="size-7" aria-hidden />}
        </div>
        <h1 className="text-xl font-semibold">{hold ? t("onHold") : t("orderPlaced")}</h1>
        <p className="num mt-2 text-muted">{placed.order.number} · {rupee(placed.order.total)}</p>
        {hold && <p className="mt-3 text-sm text-muted">{placed.order.hold_reason}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <Link to={`/orders/${placed.order.id}`}><Button variant="secondary">{t("orders")}</Button></Link>
          <Link to="/"><Button>{t("shop")}</Button></Link>
        </div>
      </Card>
    );
  }

  if (!cart.items.length) {
    return <EmptyState icon={ShoppingCart} title={t("emptyCart")} body={t("emptyCartBody")} action={<Link to={salesman?.shopTo ?? "/"}><Button>{t("goShop")}</Button></Link>} />;
  }

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_300px]">
      <section aria-label={t("cart")}>
        <h1 className="mb-4 text-xl font-semibold">{t("cart")}{salesman ? ` · ${salesman.shop.shop_name}` : ""}</h1>
        {!quote && loading ? <Skeleton rows={cart.items.length} /> : server.error && !salesman ? <p role="alert" className="text-danger">{server.error}</p> : (
          <ul className="space-y-3">
            {quote?.lines.map((line) => <CartRow key={line.sku_id} line={line} />)}
          </ul>
        )}
      </section>
      <aside className="md:sticky md:top-24 md:self-start">
        <Card className={cx("p-5 transition-opacity", loading && "opacity-60")}>
          {quote ? <Totals quote={quote} /> : <Skeleton rows={2} />}
          {salesman && <p className="mt-3 text-xs text-muted">Priced on this phone from today's prices and schemes{offline.online ? "" : " (no signal)"}. The desk's system re-checks it when it is sent.</p>}
          {overCredit && <p className="mt-4 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">{t("overCredit", { amount: rupee(available) })}</p>}
          <label htmlFor="note" className="mt-5 block text-sm text-muted">{t("note")}</label>
          <textarea id="note" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            className="mt-1 w-full rounded-xl border border-line bg-surface p-3 text-sm outline-none focus:border-accent" />
          {placeError && (
            <div role="alert" className="mt-3 text-sm text-danger">
              <p>{placeError.message}</p>
              {placeError.details.map((d) => <p key={d}>• {d}</p>)}
            </div>
          )}
          <Button size="lg" className="mt-4 w-full" onClick={place} loading={placing} disabled={!quote || loading || quote.errors.length > 0}>
            {salesman && !offline.online ? "Save order" : t("placeOrder")} {quote && !loading ? `· ${rupee(quote.total)}` : ""}
          </Button>
        </Card>
      </aside>
    </div>
  );
}

function CartRow({ line }: { line: QuoteLine }) {
  const { t, name, hint } = useLang();
  const cart = useCart();
  return (
    <li>
      <Card className={cx("p-4", line.errors.length > 0 && "border-danger")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{name(line)}</p>
            <p className="num text-sm text-muted">{rupee(line.unit_price)}/{t("perPiece")} · {line.units_per_case} {t("pieces")}/{t("perCase")} · GST {line.gst_rate}%</p>
          </div>
          <p className="num font-semibold">{rupee(line.total)}</p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Stepper value={line.qty} onChange={(v) => cart.set(line.sku_id, v)} label={`${line.name} quantity`} />
          <div className="inline-flex h-11 rounded-xl border border-line p-1" role="radiogroup" aria-label="Unit">
            {(["CASE", "PIECE"] as Unit[]).map((u) => (
              <button key={u} role="radio" aria-checked={line.unit === u} onClick={() => cart.set(line.sku_id, line.qty, u)}
                className={cx("rounded-lg px-2.5 text-sm font-medium", line.unit === u ? "bg-accent-soft text-accent" : "text-muted")}>
                {u === "CASE" ? t("cases") : t("pieces")}
              </button>
            ))}
          </div>
          <button onClick={() => cart.set(line.sku_id, 0)} className="ml-auto grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:text-danger" aria-label={`${t("remove")} ${line.name}`}>
            <Trash2 className="size-5" />
          </button>
        </div>
        {line.free_cases > 0 && <p className="mt-3 flex items-center gap-1.5 text-sm text-accent"><Gift className="size-4" aria-hidden />{t("freeCases", { n: line.free_cases, unit: line.free_cases === 1 ? t("perCase") : t("cases") })}</p>}
        {line.free_earned > line.free_cases && <p className="mt-1 text-sm text-warn">{t("freeCapped", { earned: line.free_earned, given: line.free_cases })}</p>}
        {line.discount_pct > 0 && <p className="mt-1 text-sm text-accent">{t("pctOff", { pct: line.discount_pct })}</p>}
        {line.hint_data && (
          <button onClick={() => cart.set(line.sku_id, line.qty + line.hint_data!.need)} className="mt-3 flex w-full items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-left text-sm text-accent">
            <Lightbulb className="size-4 shrink-0" aria-hidden />{hint(line.hint_data)} <span className="ml-auto font-semibold">+{line.hint_data.need}</span>
          </button>
        )}
        {line.errors.map((e) => <p key={e} role="alert" className="mt-2 text-sm text-danger">{e}</p>)}
      </Card>
    </li>
  );
}
