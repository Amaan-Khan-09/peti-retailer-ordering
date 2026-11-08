const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeRupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const rupee = (value: number) => rupees.format(value);
export const rupeeShort = (value: number) => wholeRupees.format(value);

export function timeAgo(iso: string, lang: "en" | "hi" = "en"): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const hi = lang === "hi";
  if (seconds < 60) return hi ? "अभी" : "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} ${hi ? "मिनट पहले" : "min ago"}`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ${hi ? "घंटे पहले" : "h ago"}`;
  const days = Math.floor(seconds / 86400);
  if (days === 1) return hi ? "कल" : "yesterday";
  return `${days} ${hi ? "दिन पहले" : "days ago"}`;
}

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const STATUS_LABEL: Record<string, string> = {
  PLACED: "To confirm", CREDIT_HOLD: "Credit hold", CONFIRMED: "Confirmed", EXPORTED: "Sent to Tally", CANCELLED: "Cancelled",
};

export const SOURCE_LABEL: Record<string, string> = { app: "App", ai_capture: "WhatsApp (AI)", salesman: "Salesman", desk_entry: "Typed by desk" };

/** The shop's margin per piece: printed MRP (GST included) less what the piece costs the shop with GST. */
export function margin(sku: { mrp: number; price: number; gst_rate: number }) {
  if (!sku.mrp) return null;
  const perPiece = sku.mrp - sku.price * (1 + sku.gst_rate / 100);
  return perPiece > 0 ? { perPiece, pct: Math.round((100 * perPiece) / sku.mrp) } : null;
}
