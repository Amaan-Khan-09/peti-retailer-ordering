import { Image as ImageIcon, Inbox as InboxIcon, MessageSquarePlus, Mic, Sparkles, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api";
import { timeAgo } from "../../format";
import type { Capture, Message } from "../../types";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, useAsync, useToast } from "../../ui";

export function MessageMedia({ message }: { message: Message }) {
  if (!message.has_media) return null;
  const src = `/api/desk/messages/${message.id}/media`;
  return message.kind === "voice"
    ? <audio controls preload="none" src={src} className="mt-3 w-full" aria-label="Voice note" />
    : <a href={src} target="_blank" rel="noreferrer"><img src={src} alt="Photo of the handwritten order list" loading="lazy" className="mt-3 max-h-64 w-full rounded-xl border border-line object-contain" /></a>;
}

export function TranscriptForm({ message, onSaved }: { message: Message; onSaved: (m: Message) => void }) {
  const [text, setText] = useState(message.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      onSaved(await api.post<Message>(`/api/desk/messages/${message.id}/text`, { text }));
    } catch (err) {
      setError((err as ApiError).message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save} className="mt-3">
      <label className="text-sm text-muted" htmlFor={`t-${message.id}`}>{message.kind === "voice" ? "Type what the shop says" : "Type the list as written"}</label>
      <textarea id={`t-${message.id}`} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000}
        placeholder="e.g. 5 peti marie biscuit, 2 peti chai patti 500" className="mt-1 w-full rounded-xl border border-line bg-surface p-3 outline-none focus:border-accent" />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="submit" size="sm" className="mt-2" loading={busy} disabled={text.trim().length < 2}>Save and read</Button>
    </form>
  );
}

const KIND = { voice: { icon: Mic, label: "Voice note" }, photo: { icon: ImageIcon, label: "Photo of list" } } as const;

export default function Inbox() {
  const messages = useAsync(() => api.get<Message[]>("/api/desk/messages"));
  const retailers = useAsync(() => api.get<{ id: number; shop_name: string; area: string }[]>("/api/desk/retailers"));
  const [reading, setReading] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  async function read(message: Message) {
    if (message.capture_id) return navigate(`/desk/capture/${message.capture_id}`);
    setReading(message.id);
    try {
      const capture = await api.post<Capture>(`/api/desk/messages/${message.id}/capture`);
      navigate(`/desk/capture/${capture.id}`);
    } catch (e) {
      toast((e as ApiError).message, "error");
      setReading(null);
      messages.reload();
    }
  }

  async function dismiss(message: Message) {
    await api.post(`/api/desk/messages/${message.id}/dismiss`).then(messages.reload, (e: ApiError) => toast(e.message, "error"));
  }

  return (
    <div>
      <PageHeader title="WhatsApp inbox" subtitle="Texts, Hindi voice notes and photos of handwritten lists. AI reads them into a draft; nothing is ordered until you confirm."
        actions={<Button variant="secondary" onClick={() => setComposing((v) => !v)}><MessageSquarePlus className="size-4" aria-hidden />Add a message</Button>} />
      {composing && retailers.data && <Compose retailers={retailers.data} onDone={() => { setComposing(false); messages.reload(); }} />}
      {messages.error ? <ErrorState message={messages.error} onRetry={messages.reload} /> : messages.loading ? <Skeleton rows={4} /> :
        !messages.data?.length ? <Card><EmptyState icon={InboxIcon} title="Inbox is clear" body="New WhatsApp orders will appear here." /></Card> : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {messages.data.map((m) => {
              const kind = m.kind !== "text" ? KIND[m.kind] : null;
              return (
                <li key={m.id}>
                  <Card className="flex h-full flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{m.retailer.shop_name}</p>
                        <p className="text-xs text-muted">{m.retailer.code} · {m.retailer.area} · {timeAgo(m.received_at)}</p>
                      </div>
                      <div className="flex gap-1">
                        {kind && <Badge tone="blue"><kind.icon className="size-3" aria-hidden />{kind.label}</Badge>}
                        {m.status === "NEEDS_TEXT" ? <Badge tone="amber">Type it in</Badge> : m.capture_id ? <Badge tone="blue">Draft ready</Badge> : <Badge tone="green">New</Badge>}
                      </div>
                    </div>
                    <MessageMedia message={m} />
                    {m.text ? <p className="mt-3 flex-1 rounded-2xl rounded-tl-sm bg-[#eef6ea] px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line">{m.text}</p>
                      : m.status !== "NEEDS_TEXT" && <p className="mt-3 flex-1 text-sm text-muted">AI will transcribe this when you read it.</p>}
                    {m.status === "NEEDS_TEXT" && (
                      <>
                        <p className="mt-3 text-sm text-warn">This couldn't be read automatically. {m.kind === "voice" ? "Play it" : "Open the photo"} and type the order.</p>
                        <TranscriptForm message={m} onSaved={(saved) => read(saved)} />
                      </>
                    )}
                    {m.status !== "NEEDS_TEXT" && (
                      <div className="mt-3 flex gap-2">
                        <Button className="flex-1" onClick={() => read(m)} loading={reading === m.id}>
                          <Sparkles className="size-4" aria-hidden />{m.capture_id ? "Open draft" : "Read order"}
                        </Button>
                        <Button variant="ghost" onClick={() => dismiss(m)} aria-label="Dismiss message"><X className="size-4" /></Button>
                      </div>
                    )}
                    {reading === m.id && (
                      <p className="mt-2 text-xs text-muted" role="status">
                        {m.kind === "text" ? "Reading the order…" : "Transcribing, then reading the order…"} If the AI service is busy, this can take up to 30 seconds.
                      </p>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}

function Compose({ retailers, onDone }: { retailers: { id: number; shop_name: string; area: string }[]; onDone: () => void }) {
  const [retailerId, setRetailerId] = useState(retailers[0]?.id ?? 0);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file && text.trim().length < 2) return setError("Paste the order message, or attach a voice note or photo.");
    setBusy(true);
    try {
      if (file) {
        const form = new FormData();
        form.append("retailer_id", String(retailerId));
        form.append("file", file);
        const response = await fetch("/api/desk/messages/upload", { method: "POST", body: form, credentials: "include" });
        if (!response.ok) throw new ApiError((await response.json().catch(() => ({}))).detail ?? "Upload failed", response.status);
      } else {
        await api.post("/api/desk/messages", { retailer_id: retailerId, text });
      }
      onDone();
    } catch (err) {
      setError((err as ApiError).message);
      setBusy(false);
    }
  }
  return (
    <Card className="mb-5 p-4">
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-start">
        <label className="text-sm">
          <span className="text-muted">From shop</span>
          <select value={retailerId} onChange={(e) => setRetailerId(Number(e.target.value))} className="mt-1 h-11 w-full rounded-xl border border-line bg-surface px-3">
            {retailers.map((r) => <option key={r.id} value={r.id}>{r.shop_name} · {r.area}</option>)}
          </select>
        </label>
        <div className="text-sm">
          <label htmlFor="compose-text" className="text-muted">Message (any mix of Hindi and English)</label>
          <textarea id="compose-text" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} disabled={!!file}
            placeholder="e.g. 3 peti sabun, 2 peti chai patti 500 wala" className="mt-1 w-full rounded-xl border border-line bg-surface p-3 outline-none focus:border-accent disabled:bg-canvas" />
          <label className="mt-2 flex items-center gap-2 text-muted">
            <span>or attach a voice note / photo:</span>
            <input type="file" accept="audio/*,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          </label>
          {error && <p role="alert" className="mt-1 text-danger">{error}</p>}
        </div>
        <Button type="submit" loading={busy} className="md:mt-6">Add to inbox</Button>
      </form>
      <p className="mt-2 text-xs text-faint">Stands in for the WhatsApp Business webhook, which is mocked in this build. Files up to 5 MB.</p>
    </Card>
  );
}
