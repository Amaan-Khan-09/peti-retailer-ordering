import { ArrowLeft, ShoppingCart } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { CartProvider, useCart } from "../../cart";
import { rupeeShort } from "../../format";
import { useOffline } from "../../offline/store";
import type { Bundle, BundleShop, Sku } from "../../types";
import { Card } from "../../ui";
import Cart from "../retailer/Cart";
import { ShopView } from "../retailer/Shop";

/** The shop's catalogue at its own prices, built from the bundle on the phone (works without signal). */
export function shopItems(bundle: Bundle, shop: BundleShop): Sku[] {
  return bundle.skus.map((s) => {
    const price = shop.prices[String(s.id)] ?? s.dealer_price;
    return {
      id: s.id, code: s.code, name: s.name, name_hi: s.name_hi, brand: s.brand, category: s.category, pack: s.pack,
      units_per_case: s.units_per_case, price, case_price: Math.round(price * s.units_per_case * 100) / 100, gst_rate: s.gst_rate,
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
    <Card className="mb-4 flex items-center gap-3 p-4">
      <Link to="/s" className="grid size-10 place-items-center rounded-xl border border-line text-muted" aria-label="Back to beat"><ArrowLeft className="size-5" /></Link>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{shop.shop_name}</p>
        <p className="text-sm text-muted">{shop.owner_name} · {shop.area} · credit left <span className="num">{rupeeShort(shop.credit_available)}</span></p>
      </div>
      <Link to={`/s/shop/${shop.id}/cart`} className="relative grid size-10 place-items-center rounded-xl bg-accent text-white" aria-label="Cart">
        <ShoppingCart className="size-5" />
        {cart.items.length > 0 && <span className="num absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-ink px-1.5 text-[11px] leading-5">{cart.items.length}</span>}
      </Link>
    </Card>
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
