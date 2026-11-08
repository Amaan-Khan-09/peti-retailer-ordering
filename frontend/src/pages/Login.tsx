import { ArrowLeft, ArrowRight, Gift, Headset, Languages, MapPin, MessageCircle, ShieldCheck, Store, WifiOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import type { Me } from "../types";
import { Button, Card, cx } from "../ui";

const DEMO = [
  { phone: "9000000101", who: "Retailer", detail: "Sharma Kirana Store · has special prices", icon: Store, tint: "bg-accent-soft text-accent" },
  { phone: "9000000102", who: "Retailer", detail: "Gupta General Store · close to credit limit", icon: Store, tint: "bg-accent-soft text-accent" },
  { phone: "9000000201", who: "Salesman", detail: "Rakesh Tiwari · 10 shops, works without signal", icon: MapPin, tint: "bg-gold-soft text-gold" },
  { phone: "9000000001", who: "Order desk", detail: "WhatsApp text, voice and photo orders, Tally, van loading", icon: Headset, tint: "bg-info-soft text-info" },
];

const PROMISES = [
  { icon: Gift, text: "Your prices, with every scheme worked out", hi: "आपके दाम, हर स्कीम का हिसाब" },
  { icon: WifiOff, text: "Fast on 3G, and salesmen work without signal", hi: "3G पर तेज़, बिना सिग्नल भी" },
  { icon: MessageCircle, text: "Every order update on WhatsApp", hi: "हर अपडेट WhatsApp पर" },
];

export default function Login() {
  const { setMe } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e?: FormEvent, number = phone) {
    e?.preventDefault();
    setError(null);
    if (!/^[6-9]\d{9}$/.test(number)) return setError("Enter your 10-digit mobile number.");
    setBusy(true);
    try {
      const res = await api.post<{ demo_code: string | null }>("/api/auth/otp", { phone: number });
      setDemoCode(res.demo_code);
      setCode("");
      setStep("code");
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) return setError("The code has 6 digits.");
    setBusy(true);
    try {
      setMe(await api.post<Me>("/api/auth/verify", { phone, code }));
    } catch (err) {
      setError((err as ApiError).message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[1.1fr_1fr]">
      <section className="hero relative overflow-hidden px-6 pt-10 pb-20 text-white md:flex md:flex-col md:justify-between md:p-12">
        <div className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-white/[0.06]" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-white/[0.04]" aria-hidden />
        <div className="relative flex items-center gap-3">
          <img src="/icon.svg" alt="" className="size-12 rounded-2xl ring-1 ring-white/20" />
          <div>
            <p className="text-2xl leading-tight font-extrabold tracking-tight">Peti</p>
            <p className="text-sm text-white/70">Company A · Jabalpur</p>
          </div>
        </div>
        <div className="relative mt-8 md:mt-0">
          <h1 className="max-w-md text-[28px] leading-[1.15] font-extrabold md:text-[40px]">Stock your shop in a minute.</h1>
          <p className="mt-2 text-white/75">दुकान का ऑर्डर, एक मिनट में। Hindi or English.</p>
          <ul className="mt-6 hidden space-y-3 sm:block">
            {PROMISES.map((p) => (
              <li key={p.text} className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15"><p.icon className="size-4 text-[#ffd77a]" aria-hidden /></span>
                <span className="text-sm leading-tight"><span className="block font-semibold">{p.text}</span><span className="text-white/60">{p.hi}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-8 hidden items-center gap-2 text-xs text-white/50 md:flex"><Languages className="size-4" aria-hidden />Built for kirana shops, salesmen and the order desk</p>
      </section>

      <main className="relative mx-auto -mt-12 w-full max-w-md px-4 pb-10 md:mt-0 md:flex md:flex-col md:justify-center md:py-10">
        <Card className="p-6 shadow-lift">
          {step === "phone" ? (
            <form onSubmit={sendCode} noValidate className="animate-rise">
              <h2 className="text-xl font-bold">Sign in with your mobile</h2>
              <p className="mt-1 text-sm text-muted">We'll send a 6-digit code by SMS.</p>
              <label htmlFor="phone" className="mt-6 block text-sm font-semibold">Mobile number</label>
              <div className="mt-2 flex h-14 items-center rounded-2xl border-[1.5px] border-line bg-canvas/50 transition-all focus-within:border-accent focus-within:bg-surface focus-within:shadow-[0_0_0_4px_rgb(15_122_69/0.12)]">
                <span className="flex h-full items-center gap-1.5 border-r border-line pr-3 pl-4 font-semibold text-muted">+91</span>
                <input id="phone" autoFocus inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} className="num h-full min-w-0 flex-1 bg-transparent px-3 text-lg font-semibold tracking-wider outline-none placeholder:font-normal placeholder:text-faint" placeholder="98765 43210" />
              </div>
              {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
              <Button type="submit" size="lg" className="mt-6 h-14 w-full text-base" loading={busy}>Send code<ArrowRight className="size-5" aria-hidden /></Button>
            </form>
          ) : (
            <form onSubmit={verify} noValidate className="animate-rise">
              <button type="button" onClick={() => { setStep("phone"); setError(null); }} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink">
                <ArrowLeft className="size-4" aria-hidden /> Change number
              </button>
              <h2 className="text-xl font-bold">Enter the code</h2>
              <p className="mt-1 text-sm text-muted">Sent to <span className="num font-semibold text-ink">+91 {phone.slice(0, 5)} {phone.slice(5)}</span></p>
              {demoCode && (
                <p className="bg-info-soft mt-4 rounded-xl px-4 py-3 text-sm text-info">
                  Demo mode: SMS is mocked. Your code is <button type="button" className="num font-bold underline" onClick={() => setCode(demoCode)}>{demoCode}</button> (tap to fill).
                </p>
              )}
              {!demoCode && (
                <p className="mt-4 rounded-xl bg-canvas px-4 py-3 text-sm text-muted">
                  In this demo, SMS is switched off and codes are shown only for the demo accounts listed below.
                </p>
              )}
              <label htmlFor="code" className="mt-6 block text-sm font-semibold">6-digit code</label>
              <div className="relative mt-2">
                <div className="grid grid-cols-6 gap-2" aria-hidden>
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className={cx("num grid h-14 place-items-center rounded-xl border-[1.5px] text-2xl font-bold transition-colors",
                      code[i] ? "border-accent bg-accent-soft/50 text-ink" : i === code.length ? "border-accent bg-surface" : "border-line bg-canvas/50")}>
                      {code[i] ?? ""}
                    </div>
                  ))}
                </div>
                <input id="code" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="absolute inset-0 h-full w-full cursor-text opacity-0" />
              </div>
              {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
              <Button type="submit" size="lg" className="mt-6 h-14 w-full text-base" loading={busy}>Sign in</Button>
              <button type="button" className="mt-3 w-full text-sm font-medium text-muted hover:text-ink" onClick={() => sendCode()}>Send a new code</button>
            </form>
          )}
        </Card>

        <section className="mt-6" aria-labelledby="demo-heading">
          <h2 id="demo-heading" className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-muted uppercase"><ShieldCheck className="size-4 text-accent" aria-hidden /> Demo accounts for reviewers</h2>
          <div className="space-y-2">
            {DEMO.map((d) => (
              <button key={d.phone} onClick={() => { setPhone(d.phone); sendCode(undefined, d.phone); }}
                className="group flex w-full items-center gap-3 rounded-2xl border border-ink/[0.06] bg-surface px-3 py-3 text-left shadow-card transition-all hover:-translate-y-px hover:shadow-lift active:scale-[0.99]">
                <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl", d.tint)} aria-hidden><d.icon className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{d.who}</span>
                  <span className="block text-xs text-muted">{d.detail}</span>
                </span>
                <span className="num text-xs font-semibold text-faint group-hover:text-accent">{d.phone}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
