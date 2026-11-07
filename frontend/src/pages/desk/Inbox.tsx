import { Inbox as InboxIcon, MessageSquarePlus, Sparkles, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api";
import { timeAgo } from "../../format";
import type { Capture, Message } from "../../types";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, useAsync, useToast } from "../../ui";

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
    }
  }

  async function dismiss(message: Message) {
    await api.post(`/api/desk/messages/${message.id}/dismiss`).then(messages.reload, (e: ApiError) => toast(e.message, "error"));
  }

  return (
    <div>
      <PageHeader title="WhatsApp inbox" subtitle="Orders that came in as messages. AI reads them into a draft; nothing is ordered until you confirm."
        actions={<Button variant="secondary" onClick={() => setComposing((v) => !v)}><MessageSquarePlus className="size-4" aria-hidden />Add a message</Button>} />
      {composing && retailers.data && <Compose retailers={retailers.data} onDone={() => { setComposing(false); messages.reload(); }} />}
      {messages.error ? <ErrorState message={messages.error} onRetry={messages.reload} /> : messages.loading ? <Skeleton rows={4} /> :
        !messages.data?.length ? <Card><EmptyState icon={InboxIcon} title="Inbox is clear" body="New WhatsApp orders will appear here." /></Card> : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {messages.data.map((m) => (
              <li key={m.id}>
                <Card className="flex h-full flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{m.retailer.shop_name}</p>
                      <p className="text-xs text-muted">{m.retailer.code} · {m.retailer.area} · {timeAgo(m.received_at)}</p>
                    </div>
                    {m.capture_id ? <Badge tone="blue">Draft ready</Badge> : <Badge tone="green">New</Badge>}
                  </div>
                  <p className="mt-3 flex-1 rounded-2xl rounded-tl-sm bg-[#eef6ea] px-4 py-3 text-[15px] leading-relaxed">{m.text}</p>
                  <div className="mt-3 flex gap-2">
                    <Button className="flex-1" onClick={() => read(m)} loading={reading === m.id}>
                      <Sparkles className="size-4" aria-hidden />{m.capture_id ? "Open draft" : "Read order"}
                    </Button>
                    <Button variant="ghost" onClick={() => dismiss(m)} aria-label="Dismiss message"><X className="size-4" /></Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

function Compose({ retailers, onDone }: { retailers: { id: number; shop_name: string; area: string }[]; onDone: () => void }) {
  const [retailerId, setRetailerId] = useState(retailers[0]?.id ?? 0);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim().length < 2) return setError("Paste the order message.");
    setBusy(true);
    try {
      await api.post("/api/desk/messages", { retailer_id: retailerId, text });
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
        <label className="text-sm">
          <span className="text-muted">Message (any mix of Hindi and English)</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={2000} placeholder="e.g. 3 peti sabun, 2 peti chai patti 500 wala"
            className="mt-1 w-full rounded-xl border border-line bg-surface p-3 outline-none focus:border-accent" />
          {error && <span role="alert" className="text-danger">{error}</span>}
        </label>
        <Button type="submit" loading={busy} className="md:mt-6">Add to inbox</Button>
      </form>
      <p className="mt-2 text-xs text-faint">Stands in for the WhatsApp Business webhook, which is mocked in this build.</p>
    </Card>
  );
}
