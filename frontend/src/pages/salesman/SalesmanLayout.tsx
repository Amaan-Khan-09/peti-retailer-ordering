import { CloudOff, Inbox, LogOut, MapPin, RefreshCw } from "lucide-react";
import { useEffect } from "react";
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
  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <img src="/icon.svg" alt="" className="size-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">{me?.name}</p>
            <p className="text-xs text-muted">
              {offline.syncing ? "Syncing…" : offline.bundle ? `Prices and stock from ${timeAgo(offline.bundle.generated_at)}` : "Not synced yet"}
            </p>
          </div>
          <button onClick={() => sync()} disabled={offline.syncing} className="grid size-9 place-items-center rounded-lg border border-line text-muted" aria-label="Sync now">
            <RefreshCw className={cx("size-4", offline.syncing && "animate-spin")} />
          </button>
          <button onClick={() => setLang(lang === "en" ? "hi" : "en")} className="h-9 rounded-lg border border-line px-2.5 text-sm font-medium" aria-label="Change language">
            {lang === "en" ? "हिं" : "EN"}
          </button>
          <button onClick={leave} className="grid size-9 place-items-center rounded-lg text-muted hover:text-ink" aria-label="Sign out"><LogOut className="size-5" /></button>
        </div>
        {!offline.online && (
          <p className="flex items-center justify-center gap-2 bg-warn-soft px-4 py-2 text-sm text-warn" role="status">
            <CloudOff className="size-4" aria-hidden /> No signal. Orders are saved on this phone{waiting ? ` (${waiting} waiting)` : ""} and sent when signal returns.
          </p>
        )}
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-5"><Outlet /></main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-line bg-surface md:static md:mx-auto md:mt-6 md:max-w-3xl md:rounded-2xl md:border" aria-label="Salesman">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end}
            className={({ isActive }) => cx("relative flex flex-col items-center gap-1 pt-2.5 pb-1 text-xs font-medium", isActive ? "text-accent" : "text-muted")}>
            <tab.icon className="size-6" aria-hidden />{tab.label}
            {!!tab.count && <span className="num absolute top-1.5 left-1/2 ml-2 min-w-5 rounded-full bg-warn px-1.5 text-[11px] leading-5 text-white">{tab.count}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
