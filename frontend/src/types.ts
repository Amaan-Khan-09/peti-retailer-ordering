export type Unit = "CASE" | "PIECE";
export type OrderStatus = "PLACED" | "CREDIT_HOLD" | "CONFIRMED" | "EXPORTED" | "CANCELLED";
export type Role = "retailer" | "salesman" | "desk";

export interface Me {
  id: number;
  name: string;
  role: Role;
  phone: string;
  retailer?: { id: number; code: string; shop_name: string; area: string; credit_limit: number; credit_used: number; credit_available: number };
}

export interface Scheme {
  kind: "FREE_GOODS" | "SLAB_DISCOUNT"; label: string; buy_qty: number | null; free_qty: number | null;
  min_cases: number | null; discount_pct: number | null; valid_from: string; valid_to: string;
}

export interface Sku {
  id: number; code: string; name: string; name_hi: string; brand: string; category: string; pack: string; units_per_case: number;
  price: number; case_price: number; gst_rate: number; mrp: number; stock_cases: number; stock_status: "IN" | "LOW" | "OUT"; schemes: Scheme[];
}

export interface HintData { kind: "FREE_GOODS" | "SLAB_DISCOUNT"; need: number; free_qty?: number; pct?: number }

export interface QuoteLine {
  sku_id: number; code: string; name: string; name_hi: string; pack: string; unit: Unit; qty: number; units_per_case: number;
  free_cases: number; free_earned: number; discount_pct: number; unit_price: number; gross: number; discount: number; gst: number;
  gst_rate: number; total: number; errors: string[]; hint_data: HintData | null;
}

export interface Quote {
  lines: QuoteLine[]; subtotal: number; discount_total: number; gst_total: number; total: number; free_cases_total: number; errors: string[];
}

export interface OrderLine {
  sku_id: number; code: string; name: string; name_hi: string; pack: string; unit: Unit; qty: number; free_cases: number;
  unit_price: number; gross: number; discount: number; gst: number; total: number; scheme_note: string | null;
}

export interface Order {
  id: number; number: string; status: OrderStatus; source: "app" | "ai_capture" | "salesman" | "desk_entry";
  retailer: { id: number; code: string; shop_name: string; area: string };
  subtotal: number; discount_total: number; gst_total: number; total: number; free_cases_total: number;
  hold_reason: string | null; note: string | null; created_at: string; confirmed_at: string | null; exported_at: string | null;
  line_count: number; lines?: OrderLine[]; messages?: { text: string; created_at: string }[];
}

export interface Suggestion { sku_id: number; qty: number; unit: Unit; every_days: number; days_since: number; due_in_days: number; in_stock: boolean }

export interface Message {
  id: number; text: string; channel: string; status: "NEW" | "NEEDS_TEXT" | "CAPTURED" | "ORDERED" | "DISMISSED"; received_at: string;
  order_id: number | null; capture_id: number | null; kind: "text" | "voice" | "photo"; has_media: boolean; transcript_engine: string | null;
  retailer: { id: number; code: string; shop_name: string; area: string };
}

export interface SkuBrief { id: number; code: string; name: string; pack: string; stock_cases: number; units_per_case: number }

export interface CaptureLine {
  id: number; raw_text: string; phrase: string; qty: number | null; unit: Unit | null; size_hint: string | null;
  confidence: number; level: "HIGH" | "MEDIUM" | "LOW"; reasons: string[]; suggested: SkuBrief | null; alternatives: SkuBrief[];
}

export interface Capture {
  id: number; status: "DRAFT" | "CONFIRMED"; engine: string; warnings: string[]; created_at: string; message: Message; lines: CaptureLine[];
}

export interface QuietRetailer {
  id: number; code: string; shop_name: string; owner_name: string; area: string; phone: string;
  days_since_order: number | null; last_order_at: string | null; credit_available: number;
}

export interface Metrics {
  orders_30d: number; by_source: Record<string, number>; digital_share: number; digital_target: number;
  ai_lines_checked: number; ai_corrected_pct: number | null; median_desk_minutes: number | null; median_minutes_to_order: number | null;
}

export interface Dashboard {
  orders_today: number; to_confirm: number; credit_holds: number; ready_for_tally: number; new_messages: number;
  ai_share_week: number; out_of_stock: { code: string; name: string }[]; quiet_retailers: QuietRetailer[]; metrics: Metrics;
}

export interface LoadingItem { code: string; name: string; pack: string; cases: number; free_cases: number; pieces: number }
export interface LoadingList {
  date: string; order_count: number; totals: LoadingItem[];
  routes: { area: string; total_cases: number; items: LoadingItem[]; orders: { number: string; shop_name: string; status: string; cases: number; pieces: number; total: number }[] }[];
}

export interface BundleSku {
  id: number; code: string; name: string; name_hi: string; brand: string; category: string; pack: string; units_per_case: number;
  dealer_price: number; gst_rate: number; mrp: number; stock_cases: number; schemes: Scheme[];
}
export interface BundleShop {
  id: number; code: string; shop_name: string; owner_name: string; area: string; phone: string; credit_limit: number;
  credit_used: number; credit_available: number; last_order_at: string | null; prices: Record<string, number>; suggestions: Suggestion[];
}
export interface Bundle { generated_at: string; salesman: string; shops: BundleShop[]; skus: BundleSku[] }
