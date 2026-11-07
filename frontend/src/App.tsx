import { Loader2 } from "lucide-react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { CartProvider } from "./cart";
import DeskLayout from "./pages/desk/DeskLayout";
import Capture from "./pages/desk/Capture";
import Dashboard from "./pages/desk/Dashboard";
import DeskOrders from "./pages/desk/DeskOrders";
import Inbox from "./pages/desk/Inbox";
import Login from "./pages/Login";
import Cart from "./pages/retailer/Cart";
import OrderDetail from "./pages/retailer/OrderDetail";
import Orders from "./pages/retailer/Orders";
import RetailerLayout from "./pages/retailer/RetailerLayout";
import Shop from "./pages/retailer/Shop";

export default function App() {
  const { me, loading } = useAuth();
  if (loading) {
    return <div className="grid min-h-dvh place-items-center text-muted"><Loader2 className="size-6 animate-spin" aria-label="Loading" /></div>;
  }
  if (!me) {
    return <Routes><Route path="*" element={<Login />} /></Routes>;
  }
  if (me.role === "desk") {
    return (
      <Routes>
        <Route path="/desk" element={<DeskLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="capture/:id" element={<Capture />} />
          <Route path="orders" element={<DeskOrders />} />
        </Route>
        <Route path="*" element={<Navigate to="/desk" replace />} />
      </Routes>
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
