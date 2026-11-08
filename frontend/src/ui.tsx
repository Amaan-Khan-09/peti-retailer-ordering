import { AlertTriangle, CheckCircle2, Loader2, Minus, Plus, type LucideIcon } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");
export { cx };

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white shadow-[0_1px_0_rgb(255_255_255/0.15)_inset,0_2px_8px_-2px_rgb(15_122_69/0.5)] hover:bg-accent-strong disabled:bg-faint disabled:shadow-none",
  secondary: "bg-surface text-ink border border-line shadow-card hover:border-accent/40 hover:bg-accent-soft/40 disabled:text-faint",
  ghost: "text-muted hover:text-ink hover:bg-ink/5",
  danger: "bg-surface text-danger border border-line hover:bg-danger-soft",
};

/** A short buzz on phones that support it, so a tap feels registered even on a slow network. */
export const haptic = () => { try { navigator.vibrate?.(8); } catch { /* not supported */ } };

export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  const sizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-[15px]", lg: "h-13 px-5 text-base" };
  return (
    <button {...rest} disabled={disabled || loading}
      className={cx("inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100", VARIANTS[variant], sizes[size], className)}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "gold";
const TONES: Record<Tone, string> = {
  neutral: "bg-canvas text-muted border-line", green: "bg-accent-soft text-accent border-transparent",
  amber: "bg-warn-soft text-warn border-transparent", red: "bg-danger-soft text-danger border-transparent",
  blue: "bg-info-soft text-info border-transparent", gold: "bg-gold-soft text-gold border-[#f3dfb0]",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap", TONES[tone], className)}>{children}</span>;
}

export const STATUS_TONE: Record<string, Tone> = { PLACED: "blue", CREDIT_HOLD: "amber", CONFIRMED: "green", EXPORTED: "neutral", CANCELLED: "red" };

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl border border-ink/[0.06] bg-surface shadow-card", className)}>{children}</div>;
}

export function Skeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx("space-y-3", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="shimmer h-16 animate-shimmer rounded-2xl" />)}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-accent-soft to-[#d3ecdd] text-accent shadow-card"><Icon className="size-7" aria-hidden /></div>
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-danger-soft text-danger"><AlertTriangle className="size-6" aria-hidden /></div>
      <p className="font-semibold">Couldn't load this</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>
      {onRetry && <Button variant="secondary" className="mt-5" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 9999, label, solid }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string; solid?: boolean }) {
  const step = (v: number) => { haptic(); onChange(v); };
  const btn = cx("grid h-full w-10 place-items-center transition-colors disabled:opacity-40", solid ? "text-white hover:bg-white/10" : "text-muted hover:text-ink");
  return (
    <div className={cx("inline-flex h-11 items-center overflow-hidden rounded-xl", solid ? "animate-pop bg-accent text-white shadow-glow" : "border border-line bg-surface")} role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => step(Math.max(min, value - 1))} disabled={value <= min} aria-label="Less"><Minus className="size-4" strokeWidth={2.5} /></button>
      <input className="num h-full w-10 bg-transparent text-center font-bold outline-none" inputMode="numeric" value={value} aria-label={label}
        onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, "") || "0", 10); onChange(Math.min(max, Math.max(min, n))); }} />
      <button type="button" className={btn} onClick={() => step(Math.min(max, value + 1))} disabled={value >= max} aria-label="More"><Plus className="size-4" strokeWidth={2.5} /></button>
    </div>
  );
}

export function Meter({ value, className, tone = "accent", marker }: { value: number; className?: string; tone?: "accent" | "gold" | "warn" | "light"; marker?: number }) {
  const fill = { accent: "bg-accent", gold: "bg-gradient-to-r from-[#e0a33a] to-gold", warn: "bg-warn", light: "bg-white" }[tone];
  return (
    <div className={cx("relative h-2 overflow-hidden rounded-full", tone === "light" ? "bg-white/20" : "bg-ink/[0.07]", className)}>
      <div className={cx("h-full rounded-full transition-[width] duration-500", fill)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      {marker !== undefined && <div className="absolute inset-y-0 w-0.5 bg-ink/50" style={{ left: `${marker}%` }} aria-hidden />}
    </div>
  );
}

const AVATAR_TINTS = ["bg-[#e3f1e8] text-[#0f6b3e]", "bg-[#fbeedb] text-[#9a5b12]", "bg-[#e6eefb] text-[#1f5fae]", "bg-[#f3e6f5] text-[#7a3d8a]", "bg-[#fde8e4] text-[#a3361f]"];

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const tint = AVATAR_TINTS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATAR_TINTS.length];
  return <div className={cx("grid size-11 shrink-0 place-items-center rounded-2xl text-sm font-bold", tint, className)} aria-hidden>{initials}</div>;
}

export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<{ data?: T; error?: string; loading: boolean }>({ loading: true });
  const loadRef = useRef(load);
  loadRef.current = load;
  const run = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    loadRef.current().then((data) => setState({ data, loading: false }), (e: Error) => setState({ error: e.message, loading: false }));
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(run, deps);
  return { ...state, reload: run, setData: (data: T) => setState({ data, loading: false }) };
}

type Toast = { id: number; text: string; tone: "ok" | "error" };
const ToastContext = createContext<(text: string, tone?: "ok" | "error") => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx("pointer-events-auto flex max-w-md animate-rise items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-lift", t.tone === "ok" ? "bg-ink text-white" : "bg-danger text-white")}>
            {t.tone === "ok" ? <CheckCircle2 className="size-4 shrink-0 text-[#6ee7a8]" aria-hidden /> : <AlertTriangle className="size-4 shrink-0" aria-hidden />}{t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
