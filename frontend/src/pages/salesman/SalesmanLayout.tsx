import { CloudOff, Inbox, Languages, LogOut, MapPin, RefreshCw } from "lucide-react";
import { useEffect, type CSSProperties } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth";
import { timeAgo } from "../../format";
import { useLang } from "../../i18n";
import { clearOfflineData, sync, useOffline } from "../../offline/store";
import { cx } from "../../ui";

export default function SalesmanLayout() {
  const { me, signOut } = useAuth();
  const { lang, setLang } = useLang();
  const offline = useOffline();
  const waiting = offline.outbox.filter((e) => e.status === "pending").length;
  const failed = offline.outbox.filter((e) => e.status === "failed").length;
  useEffect(() => { void sync(); }, []);

  async function leave() {
    if (waiting && !window.confirm(`${waiting} order${waiting > 1 ? "s are" : " is"} still waiting to be sent. They stay on this phone. Sign out anyway?`)) return;
    clearOfflineData();
    await signOut();
  }

  const tabs = [
    { to: "/s", label: "Beat", icon: MapPin, end: true },
    { to: "/s/outbox", label: "Outbox", icon: Inbox, count: waiting + failed },
  ];
  // The catalogue's sticky search sits under the header, which grows by the no-signal banner.
  const headerHeight = { "--header-h": offline.online ? "4rem" : "100px" } as CSSProperties;
  return (
    <div className="min-h-dvh pb-24 md:pb-10" style={headerHeight}>
      <header className="sticky top-0 z-30 border-b border-ink/[0.06] bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <img src="/icon.svg" alt="" className="size-9 rounded-xl shadow-glow" />
          <div className="min-w-0 flex-1">
            <p className="truncate leading-tight font-bold">{me?.name}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <span className={cx("size-1.5 rounded-full", offline.online ? "bg-[#22c55e]" : "bg-warn")} aria-hidden />
              {offline.syncing ? "Syncing…" : offline.bundle ? `Prices and stock from ${timeAgo(offline.bundle.generated_at)}` : "Not synced yet"}
            </p>
          </div>
          <button onClick={() => sync()} disabled={offline.syncing} className="grid size-9 place-items-center rounded-full border border-ink/[0.08] bg-surface text-muted shadow-card active:scale-95" aria-label="Sync now">
            <RefreshCw className={cx("size-4", offline.syncing && "animate-spin text-accent")} />
          </button>
          <button onClick={() => setLang(lang === "en" ? "hi" : "en")} className="flex h-9 items-center gap-1 rounded-full border border-ink/[0.08] bg-surface px-3 text-sm font-bold shadow-card active:scale-95" aria-label="Change language">
            <Languages className="size-3.5 text-accent" aria-hidden />{lang === "en" ? "हिं" : "EN"}
          </button>
          <button onClick={leave} className="grid size-9 place-items-center rounded-full text-muted hover:bg-ink/5 hover:text-ink" aria-label="Sign out"><LogOut className="size-[18px]" /></button>
        </div>
        {!offline.online && (
          <p className="flex h-9 items-center justify-center gap-2 bg-gradient-to-r from-[#8a4b00] to-warn px-4 text-sm font-medium text-white" role="status">
            <CloudOff className="size-4 shrink-0" aria-hidden /><span className="truncate">No signal. Orders are saved on this phone{waiting ? ` (${waiting} waiting)` : ""} and sent when signal returns.</span>
          </p>
        )}
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-4"><Outlet /></main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-ink/[0.06] bg-surface/95 backdrop-blur-xl md:static md:mx-auto md:mt-6 md:max-w-3xl md:rounded-2xl md:border" aria-label="Salesman">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end}
            className={({ isActive }) => cx("relative flex flex-col items-center gap-0.5 pt-2 pb-1 text-[11px] font-semibold", isActive ? "text-accent" : "text-muted")}>
            {({ isActive }) => <>
              <span className={cx("grid h-8 w-14 place-items-center rounded-full transition-colors", isActive && "bg-accent-soft")}><tab.icon className="size-[22px]" strokeWidth={isActive ? 2.4 : 2} aria-hidden /></span>
              {tab.label}
              {!!tab.count && <span key={tab.count} className="num absolute top-1 left-1/2 ml-2.5 min-w-5 animate-pop rounded-full bg-warn px-1.5 text-[11px] leading-5 text-white ring-2 ring-surface">{tab.count}</span>}
            </>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
