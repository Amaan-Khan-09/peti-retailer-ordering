/**
 * Salesman mode without signal: the day's bundle (shops, prices, schemes, stock) and an outbox of orders, both kept
 * on the phone. Orders carry a client_ref, so a retry after a dropped connection can never create a second order.
 */
import { useSyncExternalStore } from "react";
import { api, ApiError } from "../api";
import type { Bundle, Order, Unit } from "../types";

const BUNDLE_KEY = "peti.bundle";
const OUTBOX_KEY = "peti.outbox";

export interface OutboxEntry {
  client_ref: string; retailer_id: number; shop_name: string; lines: { sku_id: number; qty: number; unit: Unit }[];
  note: string | null; estimate: number; created_at: string;
  status: "pending" | "sent" | "failed"; order?: Pick<Order, "id" | "number" | "status" | "total">; error?: string; details?: string[];
}

interface State { bundle: Bundle | null; outbox: OutboxEntry[]; syncing: boolean; online: boolean; lastError: string | null }

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: keep it in memory */ }
}

let state: State = {
  bundle: read<Bundle | null>(BUNDLE_KEY, null), outbox: read<OutboxEntry[]>(OUTBOX_KEY, []), syncing: false,
  online: typeof navigator === "undefined" ? true : navigator.onLine, lastError: null,
};
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  if (patch.bundle !== undefined) write(BUNDLE_KEY, state.bundle);
  if (patch.outbox !== undefined) write(OUTBOX_KEY, state.outbox);
  listeners.forEach((l) => l());
}

export const useOffline = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);

export const newRef = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`).replace(/[^A-Za-z0-9-]/g, "");

export function queueOrder(entry: Omit<OutboxEntry, "status" | "created_at">) {
  set({ outbox: [{ ...entry, status: "pending", created_at: new Date().toISOString() }, ...state.outbox] });
  void sync();
}

export function removeEntry(ref: string) {
  set({ outbox: state.outbox.filter((e) => e.client_ref !== ref) });
}

export function retryEntry(ref: string) {
  set({ outbox: state.outbox.map((e) => (e.client_ref === ref ? { ...e, status: "pending", error: undefined, details: undefined } : e)) });
  void sync();
}

/** Sends waiting orders, then refreshes the bundle so stock, credit and schemes are today's. */
export async function sync(): Promise<void> {
  if (state.syncing) return;
  set({ syncing: true, lastError: null });
  try {
    for (const entry of state.outbox.filter((e) => e.status === "pending")) {
      try {
        const order = await api.post<Order>("/api/orders", { retailer_id: entry.retailer_id, lines: entry.lines, note: entry.note, client_ref: entry.client_ref });
        update(entry.client_ref, { status: "sent", order: { id: order.id, number: order.number, status: order.status, total: order.total } });
      } catch (e) {
        const err = e as ApiError;
        if (err.status === 0) throw err; // still offline: keep the rest waiting
        update(entry.client_ref, { status: "failed", error: err.message, details: err.details });
      }
    }
    // Signal is read from the browser, not from this request: a sync started before signal dropped must not
    // mark the phone as online again when it finishes.
    set({ bundle: await api.get<Bundle>("/api/salesman/bundle"), online: navigator.onLine });
  } catch (e) {
    const err = e as ApiError;
    set({ online: err.status !== 0 ? state.online : false, lastError: err.status === 0 ? null : err.message });
  } finally {
    set({ syncing: false });
  }
}

function update(ref: string, patch: Partial<OutboxEntry>) {
  set({ outbox: state.outbox.map((e) => (e.client_ref === ref ? { ...e, ...patch } : e)) });
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => { set({ online: true }); void sync(); });
  window.addEventListener("offline", () => set({ online: false }));
}

export function clearOfflineData() {
  set({ bundle: null, outbox: state.outbox.filter((e) => e.status === "pending") });
}
