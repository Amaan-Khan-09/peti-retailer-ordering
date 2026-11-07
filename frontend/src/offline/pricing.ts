/**
 * Scheme engine for salesman mode without signal: a port of backend/app/pricing.py.
 * Both engines are tested against backend/tests/fixtures/scheme_cases.json, so they can't drift apart.
 * Offline totals are shown as estimates; the server re-prices every order when it syncs.
 */
import type { Unit } from "../types";

export interface Rule {
  kind: "FREE_GOODS" | "SLAB_DISCOUNT"; label: string; buy_qty?: number | null; free_qty?: number | null;
  min_cases?: number | null; discount_pct?: number | null; valid_from?: string | null; valid_to?: string | null; active?: boolean;
}
export interface EngineItem { code: string; units_per_case: number; unit_price: number; gst_rate: number; stock_cases: number; schemes: Rule[] }
export interface HintData { kind: "FREE_GOODS" | "SLAB_DISCOUNT"; need: number; free_qty?: number; pct?: number }
export interface EngineLine {
  code: string; unit: Unit; qty: number; pieces: number; full_cases: number; reserved_cases: number; free_cases: number;
  free_earned: number; unit_price: number; gross: number; discount: number; discount_pct: number; gst: number; total: number;
  errors: string[]; hint_data: HintData | null;
}

/** Half-up to the paisa, like Python's Decimal ROUND_HALF_UP; the epsilon absorbs float noise (1.005 → 1.01). */
export const money = (value: number) => Math.round((value + 1e-9) * 100) / 100;

const applies = (r: Rule, today: string) => r.active !== false && (!r.valid_from || r.valid_from <= today) && (!r.valid_to || today <= r.valid_to);

export function quoteLine(item: EngineItem, qty: number, unit: Unit, today: string): EngineLine {
  const errors: string[] = [];
  if (unit !== "CASE" && unit !== "PIECE") errors.push("Choose case or piece");
  if (qty <= 0) errors.push("Quantity must be at least 1");
  qty = Math.max(qty, 0);
  const pieces = unit === "CASE" ? qty * item.units_per_case : qty;
  const full = Math.floor(pieces / item.units_per_case);
  const reserved = pieces ? Math.ceil(pieces / item.units_per_case) : 0;
  if (item.stock_cases <= 0) errors.push("Out of stock");
  else if (reserved > item.stock_cases) errors.push(`Only ${item.stock_cases} cases in stock`);

  const rules = item.schemes.filter((r) => applies(r, today));
  const gross = money(pieces * item.unit_price);
  const slabs = rules.filter((r) => r.kind === "SLAB_DISCOUNT" && r.min_cases && full >= r.min_cases);
  const pct = slabs.reduce((best, r) => Math.max(best, r.discount_pct ?? 0), 0);
  const discount = money((gross * pct) / 100);

  let earned = 0;
  for (const r of rules) if (r.kind === "FREE_GOODS" && r.buy_qty && r.free_qty) earned = Math.max(earned, Math.floor(full / r.buy_qty) * r.free_qty);
  const free = Math.min(earned, Math.max(item.stock_cases - reserved, 0));

  const gst = money(((gross - discount) * item.gst_rate) / 100);
  return {
    code: item.code, unit, qty, pieces, full_cases: full, reserved_cases: reserved, free_cases: free, free_earned: earned,
    unit_price: item.unit_price, gross, discount, discount_pct: pct, gst, total: money(gross - discount + gst), errors,
    hint_data: errors.length ? null : hint(rules, full, pct),
  };
}

function hint(rules: Rule[], full: number, pct: number): HintData | null {
  const options: HintData[] = [];
  for (const r of rules) {
    if (r.kind === "FREE_GOODS" && r.buy_qty && r.free_qty) {
      options.push({ kind: "FREE_GOODS", need: r.buy_qty - (full % r.buy_qty), free_qty: r.free_qty });
    } else if (r.kind === "SLAB_DISCOUNT" && r.min_cases && (r.discount_pct ?? 0) > pct && full < r.min_cases) {
      options.push({ kind: "SLAB_DISCOUNT", need: r.min_cases - full, pct: r.discount_pct ?? 0 });
    }
  }
  return options.filter((o) => o.need <= 5).sort((a, b) => a.need - b.need)[0] ?? null;
}

export function quoteOrder(lines: { item: EngineItem; qty: number; unit: Unit }[], today: string) {
  const quoted = lines.map((l) => quoteLine(l.item, l.qty, l.unit, today));
  const seen = new Set<string>();
  for (const line of quoted) {
    if (seen.has(line.code)) line.errors.push("Listed twice; merge the lines");
    seen.add(line.code);
  }
  const sum = (key: "gross" | "discount" | "gst" | "total") => money(quoted.reduce((s, l) => s + l[key], 0));
  return {
    lines: quoted, subtotal: sum("gross"), discount_total: sum("discount"), gst_total: sum("gst"), total: sum("total"),
    free_cases_total: quoted.reduce((s, l) => s + l.free_cases, 0),
    errors: quoted.flatMap((l) => l.errors.map((e) => `${l.code}: ${e}`)),
  };
}
