/** Mirrors backend/app/schemas/*.py. Decimals arrive as strings. */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    request_id?: string;
  };
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export type JewelleryType =
  | "necklace"
  | "chain"
  | "pendant"
  | "haram"
  | "choker"
  | "earrings"
  | "ring"
  | "bangle"
  | "bracelet"
  | "nose_ring"
  | "maang_tikka"
  | "waist_chain"
  | "anklet"
  | "set";

export type MetalType = "gold" | "white_gold" | "rose_gold" | "platinum" | "silver";
export type StoneType =
  "none" | "diamond" | "ruby" | "emerald" | "sapphire" | "pearl" | "polki" | "kundan" | "cz";
export type Gender = "women" | "men" | "unisex" | "kids";

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  jewellery_type: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  product_count: number;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  hero_image_url: string | null;
  is_bridal: boolean;
  is_featured: boolean;
  sort_order: number;
  is_active: boolean;
  product_count: number;
}

export interface ProductImage {
  id: string;
  url: string;
  alt_text: string;
  view: string;
  width: number | null;
  height: number | null;
  is_primary: boolean;
  variant_id: string | null;
}

export interface ProductVariant {
  id: string;
  sku_suffix: string;
  metal_type: MetalType;
  stone_type: StoneType;
  purity: string | null;
  price_delta: string;
  price: string;
  stock_quantity: number;
  tint_hex: string | null;
  is_default: boolean;
  is_active: boolean;
}

export interface ProductSize {
  id: string;
  label: string;
  measurement_mm: string | null;
  price_delta: string;
  stock_quantity: number;
  is_default: boolean;
}

export interface TryOnAsset {
  id: string;
  url: string;
  view: string;
  width: number;
  height: number;
  anchors: Record<string, [number, number]>;
  real_width_mm: string | null;
  real_height_mm: string | null;
  variant_id: string | null;
}

export interface Model3DAsset {
  id: string;
  url: string;
  format: string;
  file_size_bytes: number;
  scale: number;
  material_overrides: Record<string, unknown> | null;
  variant_id: string | null;
  is_primary: boolean;
}

export interface ProductSummary {
  id: string;
  sku: string;
  slug: string;
  name: string;
  short_description: string | null;
  category: Category;
  jewellery_type: JewelleryType;
  metal_type: MetalType;
  purity: string | null;
  stone_type: StoneType;
  base_price: string;
  discount_percent: string;
  price: string;
  currency: string;
  in_stock: boolean;
  is_made_to_order: boolean;
  tryon_enabled: boolean;
  has_3d: boolean;
  is_featured: boolean;
  is_new: boolean;
  gender: Gender;
  occasions: string[];
  tags: string[];
  style: string | null;
  primary_image: ProductImage | null;
  hover_image: ProductImage | null;
}

export interface ProductSetItem {
  product: ProductSummary;
  quantity: number;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  gross_weight_g: string | null;
  net_weight_g: string | null;
  stone_weight_ct: string | null;
  diamond_details: Record<string, unknown> | null;
  making_charges: string;
  stock_quantity: number;
  images: ProductImage[];
  variants: ProductVariant[];
  sizes: ProductSize[];
  tryon_assets: TryOnAsset[];
  model_3d_assets: Model3DAsset[];
  collections: Collection[];
  set_items: ProductSetItem[];
  is_active: boolean;
}

export type ProductSort = "relevance" | "newest" | "price_asc" | "price_desc" | "popular";

export interface ProductFilters {
  q?: string;
  category?: string;
  collection?: string;
  jewellery_type?: JewelleryType[];
  metal_type?: MetalType[];
  stone_type?: StoneType[];
  gender?: Gender;
  occasion?: string;
  style?: string;
  min_price?: number;
  max_price?: number;
  tryon_only?: boolean;
  in_stock_only?: boolean;
  featured?: boolean;
  is_new?: boolean;
  sort?: ProductSort;
  page?: number;
  page_size?: number;
}

export type Role = "admin" | "manager" | "sales_staff" | "customer";

export interface User {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  roles: Role[];
  is_active: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
}

export interface Session {
  user: User;
  access_expires_at: string;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state?: string;
  postal_code?: string;
  phone: string | null;
  email?: string | null;
  opening_hours?: Record<string, string> | null;
}

export interface PublicLook {
  token: string;
  title: string;
  kind: "look" | "bridal";
  preview_url: string | null;
  items: SavedLookItem[];
  total_price: string;
  created_at: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface RegisterPayload {
  full_name: string;
  email?: string;
  phone?: string;
  password: string;
  marketing_opt_in?: boolean;
}

// --- Shop ---------------------------------------------------------------------------------

export interface Adjustments {
  offset_x: number;
  offset_y: number;
  scale: number;
  rotation_deg: number;
}

export interface WishlistItem {
  id: string;
  product: ProductSummary | null;
  variant_id: string | null;
  saved_look_id: string | null;
  note: string | null;
  created_at: string;
}

export interface Wishlist {
  id: string;
  name: string;
  items: WishlistItem[];
  share_token: string | null;
  share_url: string | null;
}

export interface WishlistItemPayload {
  product_id?: string;
  variant_id?: string | null;
  saved_look_id?: string;
  note?: string;
}

export interface SavedLookItem {
  id: string;
  product: ProductSummary;
  variant_id: string | null;
  size_id: string | null;
  slot: string;
  adjustments: Partial<Adjustments> | null;
}

export interface SavedLook {
  id: string;
  title: string;
  kind: "look" | "bridal";
  preview_url: string | null;
  tryon_result_id: string | null;
  items: SavedLookItem[];
  total_price: string;
  is_public: boolean;
  share_token: string | null;
  share_url: string | null;
  share_count: number;
  notes: string | null;
  created_at: string;
}

export interface SavedLookItemPayload {
  product_id: string;
  variant_id?: string | null;
  size_id?: string | null;
  slot: string;
  adjustments?: Adjustments | null;
}

export interface SavedLookPayload {
  title: string;
  kind: "look" | "bridal";
  tryon_result_id?: string | null;
  items: SavedLookItemPayload[];
  notes?: string | null;
  is_public: boolean;
}

export interface SavedLookUpdatePayload {
  title?: string;
  notes?: string | null;
  is_public?: boolean;
}

export type AppointmentStatus = "requested" | "confirmed" | "completed" | "cancelled" | "no_show";

export interface Appointment {
  id: string;
  reference: string;
  store: Store;
  starts_at: string;
  ends_at: string;
  guest_name: string;
  guest_phone: string;
  guest_email: string | null;
  party_size: number;
  purpose: string | null;
  notes: string | null;
  status: AppointmentStatus;
  products: ProductSummary[];
  saved_look_id: string | null;
  created_at: string;
}

export interface AppointmentSlot {
  starts_at: string;
  ends_at: string;
  available: boolean;
}

export interface AppointmentPayload {
  store_id: string;
  starts_at: string;
  guest_name: string;
  guest_phone: string;
  guest_email?: string;
  party_size: number;
  purpose?: string;
  notes?: string;
  product_slugs: string[];
  product_ids?: string[];
  look_token?: string;
  saved_look_id?: string;
}

export type EnquiryStatus = "new" | "in_progress" | "resolved" | "closed";
export type ContactMethod = "phone" | "whatsapp" | "email";

export interface Enquiry {
  id: string;
  reference: string;
  name: string;
  phone: string;
  email: string | null;
  product: ProductSummary | null;
  saved_look_id: string | null;
  message: string;
  preferred_contact: ContactMethod;
  status: EnquiryStatus;
  created_at: string;
}

export interface EnquiryPayload {
  name: string;
  phone: string;
  email?: string;
  product_id?: string;
  product_slug?: string;
  saved_look_id?: string;
  look_token?: string;
  message: string;
  preferred_contact: ContactMethod;
}

export interface CartItem {
  id: string;
  product: ProductSummary;
  variant: ProductVariant | null;
  size: ProductSize | null;
  quantity: number;
  unit_price: string;
  line_total: string;
  available: boolean;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: string;
  tax_total: string;
  grand_total: string;
  currency: string;
  item_count: number;
}

export interface CartItemPayload {
  product_id: string;
  variant_id?: string | null;
  size_id?: string | null;
  quantity?: number;
}

export type FulfilmentMethod = "store_pickup" | "delivery";
export type PaymentMethod = "pay_at_store" | "bank_transfer" | "razorpay";
export type OrderStatus =
  | "pending"
  | "awaiting_payment"
  | "paid"
  | "confirmed"
  | "ready_for_pickup"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export interface Address {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface OrderItem {
  id: string;
  product_id: string | null;
  sku: string;
  name: string;
  variant_label: string | null;
  size_label: string | null;
  image_url: string | null;
  unit_price: string;
  quantity: number;
  line_total: string;
}

export interface RazorpayCheckout {
  key_id: string | null;
  order_id: string | null;
  amount: number | null;
  currency: string;
}

export interface Payment {
  id: string;
  provider: string;
  status: "created" | "authorized" | "captured" | "failed" | "refunded";
  amount: string;
  currency: string;
  provider_order_id: string | null;
  checkout: RazorpayCheckout | null;
}

export interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  fulfilment_method: FulfilmentMethod;
  store_id: string | null;
  store_name: string | null;
  payment_method: PaymentMethod;
  currency: string;
  subtotal: string;
  discount_total: string;
  tax_total: string;
  shipping_total: string;
  grand_total: string;
  shipping_address: Address | null;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  customer_notes: string | null;
  items: OrderItem[];
  payment: Payment | null;
  placed_at: string;
  paid_at: string | null;
}

export interface OrderPayload {
  fulfilment_method: FulfilmentMethod;
  store_id?: string;
  payment_method: PaymentMethod;
  contact_name: string;
  contact_phone: string;
  contact_email?: string;
  shipping_address?: Address;
  customer_notes?: string;
}

export interface PaymentConfirmPayload {
  provider_payment_id: string;
  provider_order_id: string;
  signature: string;
}

export interface StylistConstraints {
  budget_max: string | null;
  budget_min: string | null;
  occasions: string[];
  jewellery_types: string[];
  metal_types: string[];
  stone_types: string[];
  styles: string[];
  gender: string | null;
  keywords: string[];
}

export interface StylistRecommendation {
  product: ProductSummary;
  reason: string;
  score: number;
}

export interface StylistResponse {
  query: string;
  constraints: StylistConstraints;
  recommendations: StylistRecommendation[];
  note: string | null;
  llm_used: boolean;
}

export interface StylistPayload {
  query: string;
  budget_max?: number;
  occasion?: string;
  limit?: number;
}

export interface VisualMatch {
  product: ProductSummary;
  score: number;
}

export interface VisualSearchResponse {
  exact: VisualMatch | null;
  similar: VisualMatch[];
  indexed_products: number;
}

export interface CustomerProfile {
  id: string;
  user: User;
  gender: string | null;
  preferred_metal: string | null;
  preferred_store_id: string | null;
  ring_size_estimate: string | null;
  marketing_opt_in: boolean;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
}

export interface CustomerProfileUpdate {
  full_name?: string;
  gender?: string | null;
  preferred_metal?: string | null;
  preferred_store_id?: string | null;
  marketing_opt_in?: boolean;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

// --- Admin ---------------------------------------------------------------------------
// Mirrors backend/app/schemas/admin.py, commerce.py, engagement.py (staff-facing shapes).

export interface AdminCustomer {
  id: string;
  user: User & { last_login_at?: string | null };
  city: string | null;
  state: string | null;
  preferred_metal: string | null;
  marketing_opt_in: boolean;
  orders_count: number;
  appointments_count: number;
  enquiries_count: number;
  looks_count: number;
  wishlist_count: number;
  last_login_at: string | null;
  created_at: string;
}

export interface AdminCustomerDetail extends AdminCustomer {
  notes: string | null;
  phone_verified: boolean;
  email_verified: boolean;
}

export interface ProductStat {
  product_id: string;
  name: string;
  slug: string;
  image_url: string | null;
  count: number;
}

export interface TimeseriesPoint {
  date: string;
  count: number;
}

export interface AnalyticsOverview {
  range_days: number;
  totals: Record<string, number>;
  revenue: { paid: string; pending: string };
  most_tried: ProductStat[];
  most_viewed: ProductStat[];
  most_wishlisted: ProductStat[];
  most_shared: ProductStat[];
  most_enquired: ProductStat[];
  most_purchased: ProductStat[];
  tryons_per_day: TimeseriesPoint[];
  orders_per_day: TimeseriesPoint[];
  stylist_queries: number;
  visual_searches: number;
}

export interface ProductVariantInput {
  id?: string;
  sku_suffix: string;
  metal_type: MetalType;
  stone_type: StoneType;
  purity?: string | null;
  price_delta: string;
  stock_quantity: number;
  tint_hex?: string | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface ProductSizeInput {
  id?: string;
  label: string;
  measurement_mm?: string | null;
  price_delta: string;
  stock_quantity: number;
  is_default: boolean;
  sort_order: number;
}

export interface ProductInput {
  sku: string;
  name: string;
  slug?: string | null;
  short_description?: string | null;
  description?: string | null;
  category_id: string;
  jewellery_type: JewelleryType;
  metal_type: MetalType;
  purity?: string | null;
  stone_type: StoneType;
  gross_weight_g?: string | null;
  net_weight_g?: string | null;
  stone_weight_ct?: string | null;
  making_charges: string;
  base_price: string;
  discount_percent: string;
  stock_quantity: number;
  is_made_to_order: boolean;
  gender: Gender;
  occasions: string[];
  tags: string[];
  style?: string | null;
  tryon_enabled: boolean;
  is_featured: boolean;
  is_new: boolean;
  is_active: boolean;
  collection_ids: string[];
  variants: ProductVariantInput[];
  sizes: ProductSizeInput[];
  set_item_ids: string[];
}

export interface CategoryInput {
  name: string;
  slug?: string | null;
  description?: string | null;
  parent_id?: string | null;
  jewellery_type?: JewelleryType | null;
  sort_order: number;
  is_active: boolean;
}

export interface CollectionInput {
  name: string;
  slug?: string | null;
  tagline?: string | null;
  description?: string | null;
  is_bridal: boolean;
  is_featured: boolean;
  sort_order: number;
  is_active: boolean;
  product_ids?: string[] | null;
}

export interface StoreInput {
  name: string;
  slug?: string | null;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  phone?: string | null;
  email?: string | null;
  timezone: string;
  appointment_slot_minutes: number;
  is_active: boolean;
}

export interface AdminStore extends Store {
  state: string;
  postal_code: string;
  country: string;
  timezone: string;
  appointment_slot_minutes: number;
  is_active: boolean;
}

export interface StaffInput {
  full_name: string;
  email: string;
  password: string;
  roles: Role[];
}
