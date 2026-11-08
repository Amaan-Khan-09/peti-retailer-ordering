import { ClipboardList, Inbox, LayoutDashboard, LogOut, Truck } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth";
import { Avatar, cx } from "../../ui";

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
      <aside className="sticky top-0 z-30 bg-deep text-white print:hidden md:flex md:h-dvh md:w-64 md:shrink-0 md:flex-col"
        style={{ backgroundImage: "radial-gradient(120% 60% at 0% 0%, rgb(26 154 92 / 0.35), transparent 60%)" }}>
        <div className="flex h-16 items-center gap-3 px-4 md:h-20 md:px-5">
          <img src="/icon.svg" alt="" className="size-9 rounded-xl ring-1 ring-white/20" />
          <div className="min-w-0 flex-1">
            <p className="leading-tight font-extrabold tracking-tight">Peti <span className="font-medium text-white/60">desk</span></p>
            <p className="truncate text-xs text-white/55">Company A · Jabalpur</p>
          </div>
          <button onClick={signOut} className="grid size-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white md:hidden" aria-label="Sign out"><LogOut className="size-5" /></button>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col" aria-label="Desk">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => cx("flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                isActive ? "bg-white text-deep shadow-lift" : "text-white/70 hover:bg-white/[0.08] hover:text-white")}>
              <n.icon className="size-[18px]" aria-hidden />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto hidden items-center gap-3 border-t border-white/10 p-4 md:flex">
          <Avatar name={me?.name ?? "Desk"} className="size-9 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{me?.name}</p>
            <p className="text-xs text-white/55">Order desk</p>
          </div>
          <button onClick={signOut} className="grid size-9 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white" aria-label="Sign out"><LogOut className="size-[18px]" /></button>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8"><Outlet /></main>
    </div>
  );
}
