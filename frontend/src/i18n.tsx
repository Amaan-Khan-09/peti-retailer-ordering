import { createContext, useContext, useState, type ReactNode } from "react";

type Lang = "en" | "hi";

const STRINGS = {
  shop: { en: "Shop", hi: "सामान" },
  cart: { en: "Cart", hi: "कार्ट" },
  orders: { en: "Orders", hi: "ऑर्डर" },
  search: { en: "Search biscuit, tea, soap…", hi: "बिस्कुट, चाय, साबुन खोजें…" },
  all: { en: "All", hi: "सभी" },
  repeat: { en: "Repeat last order", hi: "पिछला ऑर्डर दोहराएँ" },
  repeatBody: { en: "Add everything from", hi: "सब कुछ जोड़ें:" },
  add: { en: "Add", hi: "जोड़ें" },
  perCase: { en: "case", hi: "पेटी" },
  perPiece: { en: "pc", hi: "नग" },
  cases: { en: "cases", hi: "पेटी" },
  pieces: { en: "pieces", hi: "नग" },
  exclGst: { en: "excl. GST", hi: "GST अलग" },
  inStock: { en: "In stock", hi: "स्टॉक में" },
  lowStock: { en: "Only {n} cases left", hi: "सिर्फ {n} पेटी बची" },
  outOfStock: { en: "Out of stock", hi: "स्टॉक ख़त्म" },
  creditLeft: { en: "Credit left", hi: "बचा क्रेडिट" },
  viewCart: { en: "View cart", hi: "कार्ट देखें" },
  items: { en: "items", hi: "आइटम" },
  emptyCart: { en: "Your cart is empty", hi: "कार्ट खाली है" },
  emptyCartBody: { en: "Add products from the shop, or repeat your last order.", hi: "सामान जोड़ें या पिछला ऑर्डर दोहराएँ।" },
  goShop: { en: "Go to shop", hi: "सामान देखें" },
  subtotal: { en: "Subtotal", hi: "कुल" },
  schemeDiscount: { en: "Scheme discount", hi: "स्कीम छूट" },
  gst: { en: "GST", hi: "GST" },
  total: { en: "Total incl. GST", hi: "कुल (GST सहित)" },
  free: { en: "free", hi: "मुफ़्त" },
  placeOrder: { en: "Place order", hi: "ऑर्डर करें" },
  note: { en: "Note for the desk (optional)", hi: "डेस्क के लिए नोट (वैकल्पिक)" },
  remove: { en: "Remove", hi: "हटाएँ" },
  orderPlaced: { en: "Order placed", hi: "ऑर्डर हो गया" },
  onHold: { en: "Order received, waiting for credit approval", hi: "ऑर्डर मिला, क्रेडिट मंज़ूरी बाकी" },
  noOrders: { en: "No orders yet", hi: "अभी कोई ऑर्डर नहीं" },
  noResults: { en: "Nothing matches that search", hi: "कुछ नहीं मिला" },
  signOut: { en: "Sign out", hi: "लॉग आउट" },
} satisfies Record<string, Record<Lang, string>>;

type Key = keyof typeof STRINGS;
const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key, vars?: Record<string, string | number>) => string }>(null!);

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
  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
