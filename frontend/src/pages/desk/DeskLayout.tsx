import { ClipboardList, Inbox, LayoutDashboard, LogOut, Truck } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth";
import { cx } from "../../ui";

const NAV = [
  { to: "/desk", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/desk/inbox", label: "WhatsApp inbox", icon: Inbox },
  { to: "/desk/orders", label: "Orders", icon: ClipboardList },
  { to: "/desk/loading", label: "Van loading", icon: Truck },
];

export default function DeskLayout() {
  const { me, signOut } = useAuth();
  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 z-30 border-b print:hidden border-line bg-surface md:h-dvh md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex h-16 items-center gap-3 px-4 md:px-5">
          <img src="/icon.svg" alt="" className="size-8" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">Peti desk</p>
            <p className="truncate text-xs text-muted">{me?.name}</p>
          </div>
          <button onClick={signOut} className="grid size-9 place-items-center rounded-lg text-muted hover:text-ink md:hidden" aria-label="Sign out"><LogOut className="size-5" /></button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-3" aria-label="Desk">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => cx("flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium", isActive ? "bg-accent-soft text-accent" : "text-muted hover:bg-canvas hover:text-ink")}>
              <n.icon className="size-5" aria-hidden />{n.label}
            </NavLink>
          ))}
        </nav>
        <button onClick={signOut} className="absolute bottom-5 left-3 hidden items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted hover:text-ink md:flex">
          <LogOut className="size-5" aria-hidden /> Sign out
        </button>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8"><Outlet /></main>
    </div>
  );
}
