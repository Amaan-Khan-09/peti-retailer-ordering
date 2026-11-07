export type Unit = "CASE" | "PIECE";
export type OrderStatus = "PLACED" | "CREDIT_HOLD" | "CONFIRMED" | "EXPORTED" | "CANCELLED";

export interface Me {
  id: number;
  name: string;
  role: "retailer" | "desk";
  phone: string;
  retailer?: { id: number; code: string; shop_name: string; area: string; credit_limit: number; credit_used: number; credit_available: number };
}

export interface Sku {
  id: number; code: string; name: string; brand: string; category: string; pack: string; units_per_case: number;
  price: number; case_price: number; gst_rate: number; stock_cases: number; stock_status: "IN" | "LOW" | "OUT"; schemes: string[];
}

export interface QuoteLine {
  sku_id: number; code: string; name: string; pack: string; unit: Unit; qty: number; units_per_case: number;
  free_cases: number; unit_price: number; gross: number; discount: number; gst: number; gst_rate: number; total: number;
  notes: string[]; errors: string[]; hint: string | null;
}

export interface Quote {
  lines: QuoteLine[]; subtotal: number; discount_total: number; gst_total: number; total: number; free_cases_total: number; errors: string[];
}

export interface OrderLine {
  sku_id: number; code: string; name: string; pack: string; unit: Unit; qty: number; free_cases: number; unit_price: number;
  gross: number; discount: number; gst: number; total: number; scheme_note: string | null;
}

export interface Order {
  id: number; number: string; status: OrderStatus; source: "app" | "ai_capture" | "salesman";
  retailer: { id: number; code: string; shop_name: string; area: string };
  subtotal: number; discount_total: number; gst_total: number; total: number; free_cases_total: number;
  hold_reason: string | null; note: string | null; created_at: string; confirmed_at: string | null; exported_at: string | null;
  line_count: number; lines?: OrderLine[];
}

export interface Message {
  id: number; text: string; channel: string; status: "NEW" | "CAPTURED" | "ORDERED" | "DISMISSED"; received_at: string;
  order_id: number | null; capture_id: number | null; retailer: { id: number; code: string; shop_name: string; area: string };
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

export interface Dashboard {
  orders_today: number; to_confirm: number; credit_holds: number; ready_for_tally: number; new_messages: number;
  ai_share_week: number; out_of_stock: { code: string; name: string }[]; quiet_retailers: QuietRetailer[];
}
