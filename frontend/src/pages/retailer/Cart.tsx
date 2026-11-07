import { CheckCircle2, Clock, Gift, Lightbulb, ShoppingCart, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api";
import { useAuth } from "../../auth";
import { useCart } from "../../cart";
import { rupee } from "../../format";
import { useLang } from "../../i18n";
import type { Order, Quote, QuoteLine, Unit } from "../../types";
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

export function Totals({ quote }: { quote: Quote }) {
  const { t } = useLang();
  return (
    <dl className="num space-y-2 text-sm">
      <div className="flex justify-between"><dt className="text-muted">{t("subtotal")} ({t("exclGst")})</dt><dd>{rupee(quote.subtotal)}</dd></div>
      {quote.discount_total > 0 && <div className="flex justify-between text-accent"><dt>{t("schemeDiscount")}</dt><dd>−{rupee(quote.discount_total)}</dd></div>}
      {quote.free_cases_total > 0 && <div className="flex justify-between text-accent"><dt>{t("free")}</dt><dd>{quote.free_cases_total} {t("cases")}</dd></div>}
      <div className="flex justify-between"><dt className="text-muted">{t("gst")}</dt><dd>{rupee(quote.gst_total)}</dd></div>
      <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><dt>{t("total")}</dt><dd>{rupee(quote.total)}</dd></div>
    </dl>
  );
}

export default function Cart() {
  const { t } = useLang();
  const { me, refresh } = useAuth();
  const cart = useCart();
  const { quote, error, loading } = useQuote(cart.items);
  const [note, setNote] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<{ message: string; details: string[] } | null>(null);
  const [placed, setPlaced] = useState<Order | null>(null);

  async function place() {
    setPlacing(true);
    setPlaceError(null);
    try {
      const order = await api.post<Order>("/api/orders", { lines: cart.items, note: note.trim() || null });
      setPlaced(order);
      cart.clear();
      refresh();
    } catch (e) {
      const err = e as ApiError;
      setPlaceError({ message: err.message, details: err.details });
    } finally {
      setPlacing(false);
    }
  }

  if (placed) {
    const hold = placed.status === "CREDIT_HOLD";
    return (
      <Card className="mx-auto max-w-md p-8 text-center">
        <div className={cx("mx-auto mb-4 grid size-14 place-items-center rounded-2xl", hold ? "bg-warn-soft text-warn" : "bg-accent-soft text-accent")}>
          {hold ? <Clock className="size-7" aria-hidden /> : <CheckCircle2 className="size-7" aria-hidden />}
        </div>
        <h1 className="text-xl font-semibold">{hold ? t("onHold") : t("orderPlaced")}</h1>
        <p className="num mt-2 text-muted">{placed.number} · {rupee(placed.total)}</p>
        {hold && <p className="mt-3 text-sm text-muted">{placed.hold_reason}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <Link to={`/orders/${placed.id}`}><Button variant="secondary">{t("orders")}</Button></Link>
          <Link to="/"><Button>{t("shop")}</Button></Link>
        </div>
      </Card>
    );
  }

  if (!cart.items.length) {
    return <EmptyState icon={ShoppingCart} title={t("emptyCart")} body={t("emptyCartBody")} action={<Link to="/"><Button>{t("goShop")}</Button></Link>} />;
  }

  const available = me?.retailer?.credit_available ?? 0;
  const overCredit = quote ? quote.total > available : false;
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_300px]">
      <section aria-label={t("cart")}>
        <h1 className="mb-4 text-xl font-semibold">{t("cart")}</h1>
        {!quote && loading ? <Skeleton rows={cart.items.length} /> : error ? <p role="alert" className="text-danger">{error}</p> : (
          <ul className="space-y-3">
            {quote?.lines.map((line) => <CartRow key={line.sku_id} line={line} />)}
          </ul>
        )}
      </section>
      <aside className="md:sticky md:top-24 md:self-start">
        <Card className={cx("p-5 transition-opacity", loading && "opacity-60")}>
          {quote ? <Totals quote={quote} /> : <Skeleton rows={2} />}
          {overCredit && (
            <p className="mt-4 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
              This is more than your available credit ({rupee(available)}). The order will wait for the desk to approve it.
            </p>
          )}
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
            {t("placeOrder")} {quote && !loading ? `· ${rupee(quote.total)}` : ""}
          </Button>
        </Card>
      </aside>
    </div>
  );
}

function CartRow({ line }: { line: QuoteLine }) {
  const { t } = useLang();
  const cart = useCart();
  const step = (need: number) => cart.set(line.sku_id, line.qty + need);
  const hintNeed = line.hint ? parseInt(/Add (\d+)/.exec(line.hint)?.[1] ?? "0", 10) : 0;
  return (
    <li>
      <Card className={cx("p-4", line.errors.length > 0 && "border-danger")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold">{line.name}</p>
            <p className="num text-sm text-muted">{rupee(line.unit_price)}/{t("perPiece")} · {line.unit === "CASE" ? `${line.units_per_case} ${t("pieces")}/${t("perCase")}` : ""} · GST {line.gst_rate}%</p>
          </div>
          <p className="num font-semibold">{rupee(line.total)}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Stepper value={line.qty} onChange={(v) => cart.set(line.sku_id, v)} label={`${line.name} quantity`} />
          <div className="inline-flex h-11 rounded-xl border border-line p-1" role="radiogroup" aria-label="Unit">
            {(["CASE", "PIECE"] as Unit[]).map((u) => (
              <button key={u} role="radio" aria-checked={line.unit === u} onClick={() => cart.set(line.sku_id, line.qty, u)}
                className={cx("rounded-lg px-3 text-sm font-medium", line.unit === u ? "bg-accent-soft text-accent" : "text-muted")}>
                {u === "CASE" ? t("cases") : t("pieces")}
              </button>
            ))}
          </div>
          <button onClick={() => cart.set(line.sku_id, 0)} className="ml-auto grid size-11 place-items-center rounded-xl text-muted hover:text-danger" aria-label={`${t("remove")} ${line.name}`}>
            <Trash2 className="size-5" />
          </button>
        </div>
        {line.free_cases > 0 && <p className="mt-3 flex items-center gap-1.5 text-sm text-accent"><Gift className="size-4" aria-hidden />+{line.free_cases} {t("perCase")} {t("free")}</p>}
        {line.notes.filter((n) => n.includes("% off") || n.includes("only")).map((n) => <p key={n} className="mt-1 text-sm text-muted">{n}</p>)}
        {line.hint && hintNeed > 0 && (
          <button onClick={() => step(hintNeed)} className="mt-3 flex w-full items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-left text-sm text-accent">
            <Lightbulb className="size-4 shrink-0" aria-hidden />{line.hint} <span className="ml-auto font-semibold">+{hintNeed}</span>
          </button>
        )}
        {line.errors.map((e) => <p key={e} role="alert" className="mt-2 text-sm text-danger">{e}</p>)}
      </Card>
    </li>
  );
}
