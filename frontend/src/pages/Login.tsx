import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import type { Me } from "../types";
import { Button, Card } from "../ui";

const DEMO = [
  { phone: "9000000101", who: "Retailer", detail: "Sharma Kirana Store · has special prices" },
  { phone: "9000000102", who: "Retailer", detail: "Gupta General Store · close to credit limit" },
  { phone: "9000000201", who: "Salesman", detail: "Rakesh Tiwari · 10 shops, works without signal" },
  { phone: "9000000001", who: "Order desk", detail: "WhatsApp text, voice and photo orders, Tally, van loading" },
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8 flex items-center gap-3">
        <img src="/icon.svg" alt="" className="size-11" />
        <div>
          <p className="text-lg font-semibold leading-tight">Peti</p>
          <p className="text-sm text-muted">Company A · Jabalpur</p>
        </div>
      </div>

      <Card className="p-6">
        {step === "phone" ? (
          <form onSubmit={sendCode} noValidate>
            <h1 className="text-xl font-semibold">Sign in with your mobile</h1>
            <p className="mt-1 text-sm text-muted">We'll send a 6-digit code by SMS.</p>
            <label htmlFor="phone" className="mt-6 block text-sm font-medium">Mobile number</label>
            <div className="mt-2 flex h-12 items-center rounded-xl border border-line bg-surface focus-within:border-accent">
              <span className="pl-4 pr-2 text-muted">+91</span>
              <input id="phone" autoFocus inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} className="num h-full flex-1 bg-transparent pr-4 text-lg tracking-wide outline-none" placeholder="98765 43210" />
            </div>
            {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" className="mt-6 w-full" loading={busy}>Send code</Button>
          </form>
        ) : (
          <form onSubmit={verify} noValidate>
            <button type="button" onClick={() => { setStep("phone"); setError(null); }} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
              <ArrowLeft className="size-4" aria-hidden /> Change number
            </button>
            <h1 className="text-xl font-semibold">Enter the code</h1>
            <p className="mt-1 text-sm text-muted">Sent to +91 {phone.slice(0, 5)} {phone.slice(5)}</p>
            {demoCode && (
              <p className="mt-4 rounded-xl bg-info-soft px-4 py-3 text-sm text-info">
                Demo mode: SMS is mocked. Your code is <button type="button" className="num font-semibold underline" onClick={() => setCode(demoCode)}>{demoCode}</button> (tap to fill).
              </p>
            )}
            {!demoCode && (
              <p className="mt-4 rounded-xl bg-canvas px-4 py-3 text-sm text-muted">
                In this demo, SMS is switched off and codes are shown only for the demo accounts listed below.
              </p>
            )}
            <label htmlFor="code" className="mt-6 block text-sm font-medium">6-digit code</label>
            <input id="code" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} className="num mt-2 h-12 w-full rounded-xl border border-line bg-surface px-4 text-center text-xl tracking-[0.5em] outline-none focus:border-accent" />
            {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" className="mt-6 w-full" loading={busy}>Sign in</Button>
            <button type="button" className="mt-3 w-full text-sm text-muted hover:text-ink" onClick={() => sendCode()}>Send a new code</button>
          </form>
        )}
      </Card>

      <section className="mt-8" aria-labelledby="demo-heading">
        <h2 id="demo-heading" className="mb-3 flex items-center gap-2 text-sm font-medium text-muted"><ShieldCheck className="size-4" aria-hidden /> Demo accounts for reviewers</h2>
        <div className="space-y-2">
          {DEMO.map((d) => (
            <button key={d.phone} onClick={() => { setPhone(d.phone); sendCode(undefined, d.phone); }}
              className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left hover:border-accent">
              <span>
                <span className="block text-sm font-medium">{d.who}</span>
                <span className="block text-xs text-muted">{d.detail}</span>
              </span>
              <span className="num text-sm text-muted">{d.phone}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
