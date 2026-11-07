import { createContext, useContext, useState, type ReactNode } from "react";
import type { HintData, Scheme } from "./types";

type Lang = "en" | "hi";

const STRINGS = {
  shop: { en: "Shop", hi: "सामान" },
  cart: { en: "Cart", hi: "कार्ट" },
  orders: { en: "Orders", hi: "ऑर्डर" },
  search: { en: "Search biscuit, tea, soap…", hi: "बिस्कुट, चाय, साबुन खोजें…" },
  all: { en: "All", hi: "सभी" },
  usual: { en: "Your usual order", hi: "आपका नियमित ऑर्डर" },
  usualBody: { en: "From what you buy and how often", hi: "आप क्या और कितनी बार लेते हैं, उसके हिसाब से" },
  dueNow: { en: "Due now", hi: "अभी चाहिए" },
  dueIn: { en: "in {n} days", hi: "{n} दिन में" },
  every: { en: "every {n} days", hi: "हर {n} दिन" },
  addDue: { en: "Add {n} due", hi: "{n} ज़रूरी जोड़ें" },
  addAll: { en: "Add all", hi: "सब जोड़ें" },
  repeat: { en: "Repeat last order", hi: "पिछला ऑर्डर दोहराएँ" },
  added: { en: "Added to cart", hi: "कार्ट में जोड़ा" },
  add: { en: "Add", hi: "जोड़ें" },
  perCase: { en: "case", hi: "पेटी" },
  perPiece: { en: "pc", hi: "नग" },
  cases: { en: "cases", hi: "पेटी" },
  pieces: { en: "pieces", hi: "नग" },
  exclGst: { en: "excl. GST", hi: "GST अलग" },
  lowStock: { en: "Only {n} cases left", hi: "सिर्फ {n} पेटी बची" },
  outOfStock: { en: "Out of stock", hi: "स्टॉक ख़त्म" },
  creditLeft: { en: "Credit left", hi: "बचा क्रेडिट" },
  viewCart: { en: "View cart", hi: "कार्ट देखें" },
  items: { en: "items", hi: "आइटम" },
  emptyCart: { en: "Your cart is empty", hi: "कार्ट खाली है" },
  emptyCartBody: { en: "Add products from the shop, or your usual order.", hi: "सामान जोड़ें या नियमित ऑर्डर लें।" },
  goShop: { en: "Go to shop", hi: "सामान देखें" },
  subtotal: { en: "Subtotal", hi: "कुल" },
  schemeDiscount: { en: "Scheme discount", hi: "स्कीम छूट" },
  gst: { en: "GST", hi: "GST" },
  total: { en: "Total incl. GST", hi: "कुल (GST सहित)" },
  free: { en: "free", hi: "मुफ़्त" },
  freeCases: { en: "+{n} {unit} free", hi: "+{n} {unit} मुफ़्त" },
  pctOff: { en: "{pct}% scheme discount applied", hi: "{pct}% स्कीम छूट लगी" },
  freeCapped: { en: "{earned} free earned, only {given} in stock", hi: "{earned} मुफ़्त बनते हैं, स्टॉक में {given}" },
  placeOrder: { en: "Place order", hi: "ऑर्डर करें" },
  note: { en: "Note for the desk (optional)", hi: "डेस्क के लिए नोट (वैकल्पिक)" },
  remove: { en: "Remove", hi: "हटाएँ" },
  orderPlaced: { en: "Order placed", hi: "ऑर्डर हो गया" },
  onHold: { en: "Order received, waiting for credit approval", hi: "ऑर्डर मिला, क्रेडिट मंज़ूरी बाकी" },
  overCredit: { en: "This is more than your available credit ({amount}). The order will wait for the desk to approve it.",
    hi: "यह आपके बचे क्रेडिट ({amount}) से ज़्यादा है। ऑर्डर डेस्क की मंज़ूरी के बाद आगे बढ़ेगा।" },
  noOrders: { en: "No orders yet", hi: "अभी कोई ऑर्डर नहीं" },
  noResults: { en: "Nothing matches that search", hi: "कुछ नहीं मिला" },
  signOut: { en: "Sign out", hi: "लॉग आउट" },
  whatsapp: { en: "WhatsApp updates sent to the shop", hi: "दुकान को भेजे गए WhatsApp संदेश" },
  stepPlaced: { en: "Placed", hi: "ऑर्डर हुआ" },
  stepConfirmed: { en: "Confirmed by desk", hi: "डेस्क ने पक्का किया" },
  stepBilled: { en: "Billed in Tally", hi: "बिल बन गया" },
} satisfies Record<string, Record<Lang, string>>;

const CATEGORIES: Record<string, string> = { Biscuits: "बिस्कुट", "Home care": "घरेलू सफ़ाई", Tea: "चाय", "Personal care": "पर्सनल केयर" };
const STATUS: Record<string, Record<Lang, string>> = {
  PLACED: { en: "To confirm", hi: "पुष्टि बाकी" }, CREDIT_HOLD: { en: "Credit hold", hi: "क्रेडिट मंज़ूरी बाकी" },
  CONFIRMED: { en: "Confirmed", hi: "पक्का" }, EXPORTED: { en: "Sent to Tally", hi: "बिल बन गया" }, CANCELLED: { en: "Cancelled", hi: "रद्द" },
};

type Key = keyof typeof STRINGS;
interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key, vars?: Record<string, string | number>) => string;
  category: (c: string) => string;
  name: (item: { name: string; name_hi?: string }) => string;
  scheme: (s: Scheme) => string;
  hint: (h: HintData) => string;
  status: (s: string) => string;
}
const LangContext = createContext<LangState>(null!);

function stored(): Lang {
  try {
    return localStorage.getItem("peti.lang") === "hi" ? "hi" : "en";
  } catch {
    return "en";
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(stored);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("peti.lang", l); } catch { /* private mode: keep it for this visit */ }
  };
  const t = (key: Key, vars: Record<string, string | number> = {}) =>
    Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), STRINGS[key][lang]);
  const plural = (n: number) => (lang === "hi" ? "पेटी" : n === 1 ? "case" : "cases");
  const scheme = (s: Scheme) => {
    if (s.kind === "FREE_GOODS") {
      return lang === "hi" ? `${s.buy_qty} पेटी पर ${s.free_qty} पेटी मुफ़्त` : `Buy ${s.buy_qty} ${plural(s.buy_qty ?? 0)} get ${s.free_qty} free`;
    }
    return lang === "hi" ? `${s.min_cases}+ पेटी पर ${s.discount_pct}% छूट` : `${s.discount_pct}% off ${s.min_cases} or more cases`;
  };
  const hint = (h: HintData) => {
    if (h.kind === "FREE_GOODS") {
      return lang === "hi" ? `${h.need} पेटी और जोड़ें, ${h.free_qty} पेटी मुफ़्त पाएँ` : `Add ${h.need} more ${plural(h.need)} to get ${h.free_qty} free`;
    }
    return lang === "hi" ? `${h.need} पेटी और जोड़ें, ${h.pct}% छूट पाएँ` : `Add ${h.need} more ${plural(h.need)} for ${h.pct}% off`;
  };
  return (
    <LangContext.Provider value={{
      lang, setLang, t, scheme, hint,
      category: (c) => (lang === "hi" ? CATEGORIES[c] ?? c : c),
      name: (item) => (lang === "hi" && item.name_hi ? item.name_hi : item.name),
      status: (s) => STATUS[s]?.[lang] ?? s,
    }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);
