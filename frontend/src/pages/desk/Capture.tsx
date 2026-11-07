import { AlertTriangle, ArrowLeft, Bot, CheckCircle2, RefreshCw, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../../api";
import { rupee, timeAgo } from "../../format";
import type { Capture as CaptureData, CaptureLine, Order, Sku, Unit } from "../../types";
import { Badge, Button, Card, ErrorState, Skeleton, Stepper, cx, useAsync, useToast } from "../../ui";
import { Totals, useQuote } from "../retailer/Cart";
import { MessageMedia, TranscriptForm } from "./Inbox";

interface Decision { sku_id: number | null; qty: number | null; unit: Unit | null; removed: boolean }
const LEVEL = { HIGH: { tone: "green", label: "High match" }, MEDIUM: { tone: "amber", label: "Check" }, LOW: { tone: "red", label: "Unsure" } } as const;

export default function Capture() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const capture = useAsync(() => api.get<CaptureData>(`/api/desk/captures/${id}`), [id]);
  const retailerId = capture.data?.message.retailer.id;
  const catalogue = useAsync(() => retailerId ? api.get<{ items: Sku[] }>(`/api/catalogue?retailer_id=${retailerId}`) : Promise.resolve({ items: [] }), [retailerId]);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [saving, setSaving] = useState(false);
  const [rereading, setRereading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<{ order: Order; learned: string[] } | null>(null);
  const [error, setError] = useState<{ message: string; details: string[] } | null>(null);

  useEffect(() => {
    if (!capture.data) return;
    setDecisions(Object.fromEntries(capture.data.lines.map((l) => [l.id, { sku_id: l.suggested?.id ?? null, qty: l.qty, unit: l.unit, removed: false }])));
  }, [capture.data]);

  const kept = useMemo(() => (capture.data?.lines ?? []).filter((l) => decisions[l.id] && !decisions[l.id].removed), [capture.data, decisions]);
  const ready = kept.filter((l) => { const d = decisions[l.id]; return d.sku_id && d.qty && d.unit; });
  const unresolved = kept.length - ready.length;
  const { quote, loading: quoting } = useQuote(ready.map((l) => ({ sku_id: decisions[l.id].sku_id!, qty: decisions[l.id].qty!, unit: decisions[l.id].unit! })), retailerId);

  const update = (lineId: number, patch: Partial<Decision>) => setDecisions((d) => ({ ...d, [lineId]: { ...d[lineId], ...patch } }));

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      const lines = capture.data!.lines.map((l) => ({ line_id: l.id, ...decisions[l.id] }));
      setResult(await api.post(`/api/desk/captures/${id}/confirm`, { lines }));
    } catch (e) {
      const err = e as ApiError;
      setError({ message: err.message, details: err.details });
    } finally {
      setSaving(false);
    }
  }

  async function reread() {
    setRereading(true);
    try {
      const fresh = await api.post<CaptureData>(`/api/desk/messages/${capture.data!.message.id}/capture`);
      navigate(`/desk/capture/${fresh.id}`, { replace: true });
    } catch (e) {
      toast((e as ApiError).message, "error");
    } finally {
      setRereading(false);
    }
  }

  if (capture.error) return <ErrorState message={capture.error} onRetry={capture.reload} />;
  if (capture.loading || !capture.data) return <Skeleton rows={5} />;
  const c = capture.data;

  if (result) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent"><CheckCircle2 className="size-7" aria-hidden /></div>
        <h1 className="text-xl font-semibold">Order {result.order.number} created</h1>
        <p className="num mt-2 text-muted">{c.message.retailer.shop_name} · {rupee(result.order.total)} · {result.order.status === "CREDIT_HOLD" ? "on credit hold" : "ready to confirm"}</p>
        {result.learned.length > 0 && (
          <p className="mt-4 rounded-xl bg-info-soft px-4 py-3 text-sm text-info">
            Remembered for this shop: {result.learned.map((p) => `“${p}”`).join(", ")}. Next time these words map to the product you picked.
          </p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/desk/inbox"><Button variant="secondary">Back to inbox</Button></Link>
          <Link to={`/desk/orders?tab=${result.order.status}`}><Button>See order</Button></Link>
        </div>
      </Card>
    );
  }

  const options = catalogue.data?.items ?? [];
  return (
    <div>
      <Link to="/desk/inbox" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden /> Inbox</Link>
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          <Card className="p-4">
            <p className="font-semibold">{c.message.retailer.shop_name}</p>
            <p className="text-xs text-muted">{c.message.retailer.code} · {c.message.retailer.area} · {timeAgo(c.message.received_at)}</p>
            <MessageMedia message={c.message} />
            {c.message.kind !== "text" && <p className="mt-3 text-xs font-medium text-muted">Transcript{c.message.transcript_engine ? ` · ${c.message.transcript_engine}` : ""}</p>}
            <p className="mt-1 rounded-2xl rounded-tl-sm bg-[#eef6ea] px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line">{c.message.text}</p>
            {c.message.kind !== "text" && c.status === "DRAFT" && (editing
              ? <TranscriptForm message={c.message} onSaved={() => { setEditing(false); reread(); }} />
              : <button onClick={() => setEditing(true)} className="mt-2 text-sm text-info underline">Fix the transcript</button>)}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><Bot className="size-3.5" aria-hidden />
              Order lines read by {c.engine === "rules" ? "simple rules (no AI)" : c.engine}</p>
          </Card>
          {c.warnings.map((w) => (
            <p key={w} className="flex gap-2 rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{w}</p>
          ))}
          <Button variant="secondary" className="w-full" onClick={reread} loading={rereading} disabled={c.status !== "DRAFT"}><RefreshCw className="size-4" aria-hidden />Read again</Button>
        </aside>

        <section aria-label="Draft order">
          <h1 className="mb-1 text-xl font-semibold">Check the draft</h1>
          <p className="mb-4 text-sm text-muted">Each line shows the shop's own words. Fix anything that's wrong; your corrections are remembered for this shop.</p>
          {c.status !== "DRAFT" && <p className="mb-4 rounded-xl bg-info-soft px-4 py-3 text-sm text-info">This draft was already turned into an order.</p>}
          <ul className="space-y-3">
            {c.lines.map((line) => decisions[line.id] && (
              <LineCard key={line.id} line={line} decision={decisions[line.id]} options={options} onChange={(p) => update(line.id, p)} />
            ))}
          </ul>
          {c.lines.length === 0 && <Card className="p-6 text-center text-muted">No products found in this message. Dismiss it from the inbox or ask the shop.</Card>}

          <Card className="mt-5 p-5">
            {quote && ready.length > 0 ? <div className={cx(quoting && "opacity-60")}><Totals quote={quote} /></div> : <p className="text-sm text-muted">Totals appear once a line is complete.</p>}
            {quote?.errors.map((e) => <p key={e} role="alert" className="mt-2 text-sm text-danger">{e}</p>)}
            {error && <div role="alert" className="mt-3 text-sm text-danger"><p>{error.message}</p>{error.details.map((d) => <p key={d}>• {d}</p>)}</div>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={confirm} loading={saving}
                disabled={c.status !== "DRAFT" || unresolved > 0 || ready.length === 0 || quoting || (quote?.errors.length ?? 0) > 0}>
                Create order{quote && ready.length ? ` · ${rupee(quote.total)}` : ""}
              </Button>
              {unresolved > 0 && <p className="text-sm text-warn">{unresolved} line{unresolved > 1 ? "s need" : " needs"} a product, quantity or unit</p>}
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

function LineCard({ line, decision, options, onChange }: { line: CaptureLine; decision: Decision; options: Sku[]; onChange: (p: Partial<Decision>) => void }) {
  const level = LEVEL[line.level];
  const changed = decision.sku_id !== (line.suggested?.id ?? null);
  const picked = options.find((o) => o.id === decision.sku_id);
  const suggestedIds = new Set([line.suggested?.id, ...line.alternatives.map((a) => a.id)]);
  if (decision.removed) {
    return (
      <li><Card className="flex items-center justify-between p-4 text-muted">
        <span className="line-through">“{line.raw_text}”</span>
        <Button variant="ghost" size="sm" onClick={() => onChange({ removed: false })}><Undo2 className="size-4" aria-hidden />Restore</Button>
      </Card></li>
    );
  }
  return (
    <li>
      <Card className={cx("p-4", (!decision.unit || !decision.sku_id) && "border-warn")}>
        <div className="flex items-start justify-between gap-3">
          <blockquote className="text-[15px] font-medium">“{line.raw_text}”</blockquote>
          <div className="flex shrink-0 items-center gap-1">
            <Badge tone={level.tone}>{level.label} · {Math.round(line.confidence * 100)}%</Badge>
            <button onClick={() => onChange({ removed: true })} className="grid size-8 place-items-center rounded-lg text-muted hover:text-danger" aria-label="Remove line"><X className="size-4" /></button>
          </div>
        </div>
        <ul className="mt-1 space-y-0.5 text-xs text-muted">{line.reasons.map((r) => <li key={r}>· {r}</li>)}</ul>

        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <label className="text-sm">
            <span className="sr-only">Product</span>
            <select value={decision.sku_id ?? ""} onChange={(e) => onChange({ sku_id: e.target.value ? Number(e.target.value) : null })}
              className={cx("h-11 w-full rounded-xl border bg-surface px-3", decision.sku_id ? "border-line" : "border-warn")}>
              <option value="">Choose a product…</option>
              <optgroup label="Best matches">
                {[line.suggested, ...line.alternatives].filter(Boolean).map((s) => (
                  <option key={s!.id} value={s!.id}>{s!.name}{s!.stock_cases <= 0 ? " · out of stock" : ""}</option>
                ))}
              </optgroup>
              <optgroup label="All products">
                {options.filter((o) => !suggestedIds.has(o.id)).map((o) => <option key={o.id} value={o.id}>{o.name}{o.stock_status === "OUT" ? " · out of stock" : ""}</option>)}
              </optgroup>
            </select>
          </label>
          <Stepper value={decision.qty ?? 0} min={0} onChange={(v) => onChange({ qty: v || null })} label="Quantity" />
          <div className={cx("inline-flex h-11 rounded-xl border p-1", decision.unit ? "border-line" : "border-warn")} role="radiogroup" aria-label="Case or piece">
            {(["CASE", "PIECE"] as Unit[]).map((u) => (
              <button key={u} role="radio" aria-checked={decision.unit === u} onClick={() => onChange({ unit: u })}
                className={cx("rounded-lg px-3 text-sm font-medium", decision.unit === u ? "bg-accent-soft text-accent" : "text-muted")}>
                {u === "CASE" ? "Case" : "Piece"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {!decision.unit && <span className="text-warn">Ask the shop: case or piece?</span>}
          {picked && <span className="num text-muted">{rupee(picked.case_price)}/case · {picked.units_per_case} pcs · {picked.stock_cases} cases in stock</span>}
          {changed && decision.sku_id && <span className="text-info">Correction: will be remembered for this shop</span>}
        </div>
      </Card>
    </li>
  );
}
