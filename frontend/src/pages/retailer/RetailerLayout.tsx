import { ClipboardList, Languages, LogOut, ShoppingCart, Store } from "lucide-react";
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
      <header className="sticky top-0 z-30 border-b border-ink/[0.06] bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <img src="/icon.svg" alt="" className="size-9 rounded-xl shadow-glow" />
          <div className="min-w-0 flex-1">
            <p className="truncate leading-tight font-bold">{shop.shop_name}</p>
            <p className="text-xs text-muted">{t("creditLeft")} <span className="num font-semibold text-accent">{rupeeShort(shop.credit_available)}</span></p>
          </div>
          <nav className="hidden gap-1 rounded-xl bg-ink/[0.04] p-1 md:flex">
            {tabs.map((tab) => (
              <NavLink key={tab.to} to={tab.to} end={tab.end}
                className={({ isActive }) => cx("rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors", isActive ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}>
                {tab.label}{tab.count ? ` (${tab.count})` : ""}
              </NavLink>
            ))}
          </nav>
          <button onClick={() => setLang(lang === "en" ? "hi" : "en")} className="flex h-9 items-center gap-1 rounded-full border border-ink/[0.08] bg-surface px-3 text-sm font-bold shadow-card active:scale-95" aria-label="Change language">
            <Languages className="size-3.5 text-accent" aria-hidden />{lang === "en" ? "हिं" : "EN"}
          </button>
          <button onClick={signOut} className="grid size-9 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink" aria-label={t("signOut")}><LogOut className="size-[18px]" /></button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-4"><Outlet /></main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-ink/[0.06] bg-surface/95 backdrop-blur-xl md:hidden" aria-label="Main">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end}
            className={({ isActive }) => cx("group relative flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-semibold", isActive ? "text-accent" : "text-muted")}>
            {({ isActive }) => <>
              <span className={cx("grid h-8 w-14 place-items-center rounded-full transition-colors", isActive && "bg-accent-soft")}><tab.icon className="size-[22px]" strokeWidth={isActive ? 2.4 : 2} aria-hidden /></span>
              {tab.label}
              {!!tab.count && <span key={tab.count} className="num absolute top-1 left-1/2 ml-2.5 min-w-5 animate-pop rounded-full bg-gold px-1.5 text-[11px] leading-5 text-white ring-2 ring-surface">{tab.count}</span>}
            </>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
