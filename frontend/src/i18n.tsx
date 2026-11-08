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
  dueTomorrow: { en: "tomorrow", hi: "कल" },
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
  hello: { en: "Namaste", hi: "नमस्ते" },
  availableCredit: { en: "Available credit", hi: "उपलब्ध क्रेडिट" },
  ofLimit: { en: "of {limit} limit", hi: "{limit} लिमिट में से" },
  liveSchemes: { en: "{n} products on scheme", hi: "{n} सामान पर स्कीम" },
  dueCount: { en: "{n} due today", hi: "{n} आज चाहिए" },
  smart: { en: "Smart pick", hi: "स्मार्ट सुझाव" },
  margin: { en: "{pct}% margin", hi: "{pct}% मार्जिन" },
  productsCount: { en: "{n} products", hi: "{n} सामान" },
  youSave: { en: "You save {amount} on this order", hi: "इस ऑर्डर पर {amount} की बचत" },
  saveBreakdown: { en: "Schemes applied automatically", hi: "स्कीम अपने आप लगी" },
  schemeProgress: { en: "{have} of {need} cases", hi: "{need} में से {have} पेटी" },
  orderSummary: { en: "Bill summary", hi: "बिल का हिसाब" },
  placedBody: { en: "The desk will confirm it, and the shop gets each update on WhatsApp.", hi: "डेस्क इसे पक्का करेगा, हर अपडेट WhatsApp पर आएगा।" },
  viewOrder: { en: "See order", hi: "ऑर्डर देखें" },
  keepShopping: { en: "Keep shopping", hi: "और सामान लें" },
  inclGst: { en: "incl. GST", hi: "GST सहित" },
  // Sign-in
  heroTitle: { en: "Stock your shop in a minute.", hi: "दुकान का ऑर्डर, एक मिनट में।" },
  heroSub: { en: "In Hindi or English, on any phone.", hi: "हिंदी या अंग्रेज़ी में, किसी भी फ़ोन पर।" },
  signInTitle: { en: "Sign in with your mobile", hi: "मोबाइल नंबर से लॉग इन करें" },
  signInBody: { en: "We'll send a 6-digit code by SMS.", hi: "हम SMS से 6 अंकों का कोड भेजेंगे।" },
  mobile: { en: "Mobile number", hi: "मोबाइल नंबर" },
  sendCode: { en: "Send code", hi: "कोड भेजें" },
  changeNumber: { en: "Change number", hi: "नंबर बदलें" },
  enterCode: { en: "Enter the code", hi: "कोड डालें" },
  sentTo: { en: "Sent to", hi: "भेजा गया" },
  codeLabel: { en: "6-digit code", hi: "6 अंकों का कोड" },
  signIn: { en: "Sign in", hi: "लॉग इन" },
  newCode: { en: "Send a new code", hi: "नया कोड भेजें" },
  badPhone: { en: "Enter your 10-digit mobile number.", hi: "अपना 10 अंकों का मोबाइल नंबर डालें।" },
  badCode: { en: "The code has 6 digits.", hi: "कोड 6 अंकों का होता है।" },
  demoBefore: { en: "Demo mode: SMS is mocked. Your code is", hi: "डेमो: SMS बंद है। आपका कोड है" },
  demoAfter: { en: "(tap to fill).", hi: "(भरने के लिए दबाएँ)।" },
  noDemo: { en: "In this demo, SMS is switched off and codes are shown only for the demo accounts listed below.",
    hi: "इस डेमो में SMS बंद है; कोड सिर्फ़ नीचे दिए डेमो खातों के लिए दिखता है।" },
  demoAccounts: { en: "Demo accounts for reviewers", hi: "जाँच के लिए डेमो खाते" },
  // Salesman
  beat: { en: "Beat", hi: "बीट" },
  outbox: { en: "Outbox", hi: "आउटबॉक्स" },
  syncing: { en: "Syncing…", hi: "सिंक हो रहा है…" },
  pricesFrom: { en: "Prices and stock from {time}", hi: "दाम और स्टॉक: {time}" },
  notSynced: { en: "Not synced yet", hi: "अभी सिंक नहीं हुआ" },
  syncNow: { en: "Sync now", hi: "अभी सिंक करें" },
  noSignal: { en: "No signal. Orders are saved on this phone and sent when signal returns.", hi: "सिग्नल नहीं है। ऑर्डर इसी फ़ोन में सेव हैं, सिग्नल आते ही भेजे जाएँगे।" },
  waitingCount: { en: "{n} waiting", hi: "{n} बाकी" },
  leaveWaiting: { en: "{n} order(s) still waiting to be sent. They stay on this phone. Sign out anyway?", hi: "{n} ऑर्डर अभी भेजने बाकी हैं। वे इसी फ़ोन में रहेंगे। फिर भी लॉग आउट करें?" },
  todaysBeat: { en: "Today's beat", hi: "आज की बीट" },
  beatBody: { en: "Open a shop to take its order, with its own prices, schemes and credit.", hi: "दुकान खोलें और उसके अपने दाम, स्कीम और क्रेडिट से ऑर्डर लें।" },
  statShops: { en: "shops", hi: "दुकानें" },
  statDue: { en: "need stock", hi: "माल चाहिए" },
  statSent: { en: "orders sent", hi: "ऑर्डर भेजे" },
  statWaiting: { en: "waiting", hi: "बाकी" },
  searchShops: { en: "Shop, owner or area", hi: "दुकान, मालिक या इलाका" },
  lastOrder: { en: "last order {time}", hi: "पिछला ऑर्डर {time}" },
  dueBadge: { en: "{n} due", hi: "{n} चाहिए" },
  waitingBadge: { en: "{n} waiting to send", hi: "{n} भेजना बाकी" },
  creditReached: { en: "Credit limit reached", hi: "क्रेडिट लिमिट पूरी" },
  downloadBeat: { en: "Download today's beat", hi: "आज की बीट डाउनलोड करें" },
  downloadBody: { en: "Prices, schemes and stock for your shops are saved on this phone so you can take orders without signal.",
    hi: "आपकी दुकानों के दाम, स्कीम और स्टॉक इस फ़ोन में सेव होते हैं, ताकि बिना सिग्नल भी ऑर्डर ले सकें।" },
  downloadNow: { en: "Download now", hi: "अभी डाउनलोड करें" },
  backToBeat: { en: "Back to beat", hi: "बीट पर वापस" },
  outboxBody: { en: "Orders taken on this phone. Waiting orders are sent automatically when there is signal.", hi: "इस फ़ोन से लिए गए ऑर्डर। सिग्नल आते ही बाकी ऑर्डर अपने आप भेजे जाते हैं।" },
  sendNow: { en: "Send {n} now", hi: "{n} अभी भेजें" },
  noOutbox: { en: "No orders taken yet today", hi: "आज अभी कोई ऑर्डर नहीं लिया" },
  lineCount: { en: "{n} lines", hi: "{n} आइटम" },
  estimate: { en: "(estimate)", hi: "(अनुमान)" },
  waitingSignal: { en: "Waiting for signal", hi: "सिग्नल का इंतज़ार" },
  fixWithShop: { en: "Stock or credit changed since the order was taken. Fix it with the shop, then retry or remove it.", hi: "ऑर्डर लेने के बाद स्टॉक या क्रेडिट बदल गया। दुकान से बात करके दोबारा भेजें या हटाएँ।" },
  retry: { en: "Retry", hi: "दोबारा भेजें" },
  sentAs: { en: "Sent as {n}", hi: "{n} भेजा गया" },
  needsAttention: { en: "Needs attention", hi: "ध्यान दें" },
  savedPhone: { en: "Saved on this phone", hi: "इस फ़ोन में सेव हुआ" },
  holdCall: { en: "It is on credit hold; the desk will call the shop.", hi: "यह क्रेडिट मंज़ूरी पर रुका है; डेस्क दुकान को फ़ोन करेगा।" },
  deskConfirm: { en: "The desk will confirm it.", hi: "डेस्क इसे पक्का करेगा।" },
  sentWhenSignal: { en: "It will be sent as soon as there is signal. You can carry on with the next shop.", hi: "सिग्नल आते ही भेज दिया जाएगा। आप अगली दुकान पर जा सकते हैं।" },
  nextShop: { en: "Next shop", hi: "अगली दुकान" },
  pricedOnPhone: { en: "Priced on this phone from today's prices and schemes. The desk's system re-checks it when it is sent.", hi: "आज के दाम और स्कीम से इसी फ़ोन पर हिसाब। भेजने पर डेस्क का सिस्टम दोबारा जाँचता है।" },
  saveOrder: { en: "Save order", hi: "ऑर्डर सेव करें" },
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
