import { ArrowLeft, ShoppingCart } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { CartProvider, useCart } from "../../cart";
import { rupeeShort } from "../../format";
import { useOffline } from "../../offline/store";
import type { Bundle, BundleShop, Sku } from "../../types";
import { Meter } from "../../ui";
import Cart from "../retailer/Cart";
import { ShopView } from "../retailer/Shop";

/** The shop's catalogue at its own prices, built from the bundle on the phone (works without signal). */
export function shopItems(bundle: Bundle, shop: BundleShop): Sku[] {
  return bundle.skus.map((s) => {
    const price = shop.prices[String(s.id)] ?? s.dealer_price;
    return {
      id: s.id, code: s.code, name: s.name, name_hi: s.name_hi, brand: s.brand, category: s.category, pack: s.pack,
      units_per_case: s.units_per_case, price, case_price: Math.round(price * s.units_per_case * 100) / 100, gst_rate: s.gst_rate, mrp: s.mrp,
      stock_cases: s.stock_cases, stock_status: s.stock_cases <= 0 ? "OUT" : s.stock_cases < 10 ? "LOW" : "IN", schemes: s.schemes,
    };
  });
}

function useShop() {
  const { id } = useParams();
  const { bundle } = useOffline();
  const shop = bundle?.shops.find((s) => s.id === Number(id));
  return { bundle, shop };
}

function ShopHeader({ shop }: { shop: BundleShop }) {
  const cart = useCart();
  return (
    <section className="hero relative mb-4 overflow-hidden rounded-3xl p-4 text-white shadow-lift">
      <div className="pointer-events-none absolute -top-12 -right-10 size-40 rounded-full bg-white/[0.06]" aria-hidden />
      <div className="relative flex items-center gap-3">
        <Link to="/s" className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15" aria-label="Back to beat"><ArrowLeft className="size-5" /></Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg leading-tight font-bold">{shop.shop_name}</p>
          <p className="truncate text-sm text-white/70">{shop.owner_name} · {shop.area}</p>
        </div>
        <Link to={`/s/shop/${shop.id}/cart`} className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-white text-accent shadow-lift" aria-label="Cart">
          <ShoppingCart className="size-5" />
          {cart.items.length > 0 && <span key={cart.items.length} className="num absolute -top-1.5 -right-1.5 min-w-5 animate-pop rounded-full bg-gold px-1.5 text-[11px] leading-5 text-white ring-2 ring-deep">{cart.items.length}</span>}
        </Link>
      </div>
      <div className="relative mt-4 flex items-end justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-white/60 uppercase">Credit left</p>
          <p className="num text-2xl font-extrabold">{rupeeShort(shop.credit_available)}</p>
        </div>
        <p className="num pb-1 text-xs text-white/60">of {rupeeShort(shop.credit_limit)}</p>
      </div>
      <Meter value={shop.credit_limit > 0 ? (100 * shop.credit_available) / shop.credit_limit : 0} tone="light" className="relative mt-2" />
    </section>
  );
}

export function VisitShop() {
  const { bundle, shop } = useShop();
  if (!bundle || !shop) return <Navigate to="/s" replace />;
  return (
    <CartProvider shopId={shop.id}>
      <ShopView items={shopItems(bundle, shop)} loading={false} reload={() => {}} suggestions={shop.suggestions}
        cartTo={`/s/shop/${shop.id}/cart`} header={<ShopHeader shop={shop} />} />
    </CartProvider>
  );
}

export function VisitCart() {
  const { bundle, shop } = useShop();
  if (!bundle || !shop) return <Navigate to="/s" replace />;
  return (
    <CartProvider shopId={shop.id}>
      <Link to={`/s/shop/${shop.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" aria-hidden />{shop.shop_name}</Link>
      <Cart salesman={{ shop, bundle, ordersTo: "/s/outbox", shopTo: `/s/shop/${shop.id}` }} />
    </CartProvider>
  );
}
