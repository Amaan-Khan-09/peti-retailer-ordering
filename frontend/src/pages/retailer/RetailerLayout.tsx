import { ClipboardList, LogOut, ShoppingCart, Store } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth";
import { useCart } from "../../cart";
import { rupeeShort } from "../../format";
import { useLang } from "../../i18n";
import { cx } from "../../ui";

export default function RetailerLayout() {
  const { me, signOut } = useAuth();
  const { items } = useCart();
  const { t, lang, setLang } = useLang();
  const shop = me!.retailer!;
  const tabs = [
    { to: "/", label: t("shop"), icon: Store, end: true },
    { to: "/cart", label: t("cart"), icon: ShoppingCart, count: items.length },
    { to: "/orders", label: t("orders"), icon: ClipboardList },
  ];
  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <img src="/icon.svg" alt="" className="size-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">{shop.shop_name}</p>
            <p className="text-xs text-muted">{t("creditLeft")} <span className="num font-medium text-ink">{rupeeShort(shop.credit_available)}</span></p>
          </div>
          <nav className="hidden gap-1 md:flex">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end}
                className={({ isActive }) => cx("rounded-lg px-3 py-2 text-sm font-medium", isActive ? "bg-accent-soft text-accent" : "text-muted hover:text-ink")}>
                {tab.label}{tab.count ? ` (${tab.count})` : ""}
              </NavLink>
            ))}
          </nav>
          <button onClick={() => setLang(lang === "en" ? "hi" : "en")} className="h-9 rounded-lg border border-line px-2.5 text-sm font-medium" aria-label="Change language">
            {lang === "en" ? "हिं" : "EN"}
          </button>
          <button onClick={signOut} className="grid size-9 place-items-center rounded-lg text-muted hover:text-ink" aria-label={t("signOut")}><LogOut className="size-5" /></button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-5"><Outlet /></main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-surface md:hidden" aria-label="Main">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end}
            className={({ isActive }) => cx("relative flex flex-col items-center gap-1 pt-2.5 pb-1 text-xs font-medium", isActive ? "text-accent" : "text-muted")}>
            <tab.icon className="size-6" aria-hidden />
            {tab.label}
            {!!tab.count && <span className="num absolute top-1.5 left-1/2 ml-2 min-w-5 rounded-full bg-accent px-1.5 text-[11px] leading-5 text-white">{tab.count}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
