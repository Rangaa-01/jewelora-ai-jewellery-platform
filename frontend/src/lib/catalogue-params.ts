import type {
  Gender,
  JewelleryType,
  MetalType,
  ProductFilters,
  ProductSort,
  StoneType,
} from "./api/types";
import { JEWELLERY_TYPE_LABELS, METAL_LABELS, STONE_LABELS } from "./labels";

type Search = Record<string, string | string[] | undefined>;

function list<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly string[],
): T[] | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value : value.split(",");
  const out = raw.map((v) => v.trim()).filter((v): v is T => allowed.includes(v));
  return out.length ? out : undefined;
}

function one(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v?.trim() || undefined;
}

function num(value: string | string[] | undefined): number | undefined {
  const n = Number(one(value));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

const SORTS: ProductSort[] = ["relevance", "newest", "price_asc", "price_desc", "popular"];
const GENDERS: Gender[] = ["women", "men", "unisex", "kids"];

/** Parses URL search params into validated catalogue filters (invalid values are dropped). */
export function parseProductFilters(search: Search): ProductFilters {
  const sort = one(search.sort);
  const gender = one(search.gender);
  const page = num(search.page);
  return {
    q: one(search.q)?.slice(0, 120),
    category: one(search.category),
    collection: one(search.collection),
    jewellery_type: list<JewelleryType>(search.jewellery_type, Object.keys(JEWELLERY_TYPE_LABELS)),
    metal_type: list<MetalType>(search.metal_type, Object.keys(METAL_LABELS)),
    stone_type: list<StoneType>(search.stone_type, Object.keys(STONE_LABELS)),
    gender: gender && GENDERS.includes(gender as Gender) ? (gender as Gender) : undefined,
    occasion: one(search.occasion),
    style: one(search.style),
    min_price: num(search.min_price),
    max_price: num(search.max_price),
    tryon_only: one(search.tryon_only) === "true" || undefined,
    in_stock_only: one(search.in_stock_only) === "true" || undefined,
    sort: sort && SORTS.includes(sort as ProductSort) ? (sort as ProductSort) : undefined,
    page: page && page >= 1 ? Math.floor(page) : undefined,
  };
}

/** Serialises filters back to a query string (arrays as comma lists for short URLs). */
export function filtersToSearch(filters: ProductFilters): string {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === false || value === "") continue;
    if (key === "page" && value === 1) continue;
    if (key === "page_size") continue;
    p.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}
