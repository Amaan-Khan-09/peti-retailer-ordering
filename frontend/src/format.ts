const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const wholeRupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const rupee = (value: number) => rupees.format(value);
export const rupeeShort = (value: number) => wholeRupees.format(value);

export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  const days = Math.floor(seconds / 86400);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const STATUS_LABEL: Record<string, string> = {
  PLACED: "To confirm", CREDIT_HOLD: "Credit hold", CONFIRMED: "Confirmed", EXPORTED: "Sent to Tally", CANCELLED: "Cancelled",
};

export const SOURCE_LABEL: Record<string, string> = { app: "App", ai_capture: "WhatsApp (AI)", salesman: "Salesman", desk_entry: "Typed by desk" };
