import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { CartProvider } from "./cart";
import Login from "./pages/Login";
import Cart from "./pages/retailer/Cart";
import OrderDetail from "./pages/retailer/OrderDetail";
import Orders from "./pages/retailer/Orders";
import RetailerLayout from "./pages/retailer/RetailerLayout";
import Shop from "./pages/retailer/Shop";

// Desk and salesman screens are loaded only for those roles, so a retailer's phone downloads the shop code alone.
const DeskLayout = lazy(() => import("./pages/desk/DeskLayout"));
const Dashboard = lazy(() => import("./pages/desk/Dashboard"));
const Inbox = lazy(() => import("./pages/desk/Inbox"));
const Capture = lazy(() => import("./pages/desk/Capture"));
const DeskOrders = lazy(() => import("./pages/desk/DeskOrders"));
const LoadingList = lazy(() => import("./pages/desk/LoadingList"));
const salesman = () => import("./pages/salesman");
const SalesmanLayout = lazy(() => salesman().then((m) => ({ default: m.SalesmanLayout })));
const Beat = lazy(() => salesman().then((m) => ({ default: m.Beat })));
const Outbox = lazy(() => salesman().then((m) => ({ default: m.Outbox })));
const VisitShop = lazy(() => salesman().then((m) => ({ default: m.VisitShop })));
const VisitCart = lazy(() => salesman().then((m) => ({ default: m.VisitCart })));

const spinner = <div className="grid min-h-dvh place-items-center text-muted"><Loader2 className="size-6 animate-spin" aria-label="Loading" /></div>;

export default function App() {
  const { me, loading } = useAuth();
  if (loading) return spinner;
  if (!me) return <Routes><Route path="*" element={<Login />} /></Routes>;

  if (me.role === "desk") {
    return (
      <Suspense fallback={spinner}>
        <Routes>
          <Route path="/desk" element={<DeskLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="inbox" element={<Inbox />} />
            <Route path="capture/:id" element={<Capture />} />
            <Route path="orders" element={<DeskOrders />} />
            <Route path="loading" element={<LoadingList />} />
          </Route>
          <Route path="*" element={<Navigate to="/desk" replace />} />
        </Routes>
      </Suspense>
    );
  }

  if (me.role === "salesman") {
    return (
      <Suspense fallback={spinner}>
        <Routes>
          <Route path="/s" element={<SalesmanLayout />}>
            <Route index element={<Beat />} />
            <Route path="shop/:id" element={<VisitShop />} />
            <Route path="shop/:id/cart" element={<VisitCart />} />
            <Route path="outbox" element={<Outbox />} />
          </Route>
          <Route path="*" element={<Navigate to="/s" replace />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <CartProvider shopId={me.retailer!.id}>
      <Routes>
        <Route path="/" element={<RetailerLayout />}>
          <Route index element={<Shop />} />
          <Route path="cart" element={<Cart />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </CartProvider>
  );
}
