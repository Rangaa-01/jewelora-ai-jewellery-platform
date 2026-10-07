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
  id: string;
  title: string;
  preview_url: string | null;
  share_token: string;
  item_count: number;
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
