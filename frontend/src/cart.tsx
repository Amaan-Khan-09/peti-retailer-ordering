import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Unit } from "./types";

export interface CartItem { sku_id: number; qty: number; unit: Unit }
interface CartState {
  items: CartItem[];
  set: (sku_id: number, qty: number, unit?: Unit) => void;
  replace: (items: CartItem[]) => void;
  clear: () => void;
  qtyOf: (sku_id: number) => number;
}
const CartContext = createContext<CartState>(null!);

function load(key: string): CartItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((i) => i && typeof i.sku_id === "number" && i.qty > 0) : [];
  } catch {
    return [];
  }
}

/** A cart kept per shop on this device, so a half-built order survives a dropped connection or a customer interruption. */
export function CartProvider({ shopId, children }: { shopId: number; children: ReactNode }) {
  const key = `peti.cart.${shopId}`;
  const [items, setItems] = useState<CartItem[]>(() => load(key));
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* storage unavailable: cart lives for this visit */ }
  }, [key, items]);

  const set = (sku_id: number, qty: number, unit?: Unit) =>
    setItems((current) => {
      const existing = current.find((i) => i.sku_id === sku_id);
      if (qty <= 0) return current.filter((i) => i.sku_id !== sku_id);
      if (existing) return current.map((i) => (i.sku_id === sku_id ? { ...i, qty, unit: unit ?? i.unit } : i));
      return [...current, { sku_id, qty, unit: unit ?? "CASE" }];
    });

  return (
    <CartContext.Provider value={{ items, set, replace: setItems, clear: () => setItems([]), qtyOf: (id) => items.find((i) => i.sku_id === id)?.qty ?? 0 }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
