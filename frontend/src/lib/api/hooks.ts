"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildQuery, isApiError } from "./client";
import type {
  Category,
  Collection,
  LoginPayload,
  Page,
  ProductDetail,
  ProductFilters,
  ProductSummary,
  PublicLook,
  RegisterPayload,
  Session,
  Store,
} from "./types";

export const queryKeys = {
  products: (filters: ProductFilters) => ["products", filters] as const,
  product: (slug: string) => ["product", slug] as const,
  categories: ["categories"] as const,
  collections: (featured?: boolean) => ["collections", { featured }] as const,
  collection: (slug: string) => ["collection", slug] as const,
  session: ["session"] as const,
  stores: ["stores"] as const,
  publicLooks: (limit: number) => ["looks", "public", limit] as const,
};

export function productsQueryString(filters: ProductFilters): string {
  return buildQuery({ ...filters });
}

export function useProducts(filters: ProductFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.products(filters),
    queryFn: ({ signal }) =>
      api.get<Page<ProductSummary>>(`/products${productsQueryString(filters)}`, { signal }),
    enabled,
    staleTime: 60_000,
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: queryKeys.product(slug),
    queryFn: ({ signal }) =>
      api.get<ProductDetail>(`/products/${encodeURIComponent(slug)}`, { signal }),
    retry: (count, error) => !(isApiError(error) && error.status < 500) && count < 2,
    staleTime: 60_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: ({ signal }) => api.get<Category[]>("/categories", { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useCollections(featured?: boolean) {
  return useQuery({
    queryKey: queryKeys.collections(featured),
    queryFn: ({ signal }) =>
      api.get<Collection[]>(`/collections${buildQuery({ featured })}`, { signal }),
    staleTime: 5 * 60_000,
  });
}

export function useCollection(slug: string) {
  return useQuery({
    queryKey: queryKeys.collection(slug),
    queryFn: ({ signal }) =>
      api.get<Collection>(`/collections/${encodeURIComponent(slug)}`, { signal }),
    retry: (count, error) => !(isApiError(error) && error.status < 500) && count < 2,
  });
}

export function useStores() {
  return useQuery({
    queryKey: queryKeys.stores,
    queryFn: ({ signal }) => api.get<Store[]>("/stores", { signal }),
    staleTime: 10 * 60_000,
  });
}

export function usePublicLooks(limit = 6) {
  return useQuery({
    queryKey: queryKeys.publicLooks(limit),
    queryFn: async ({ signal }) => {
      try {
        return await api.get<PublicLook[]>(`/looks/public${buildQuery({ limit })}`, { signal });
      } catch (error) {
        // Until the looks feature ships (or when none are public) show an empty state.
        if (isApiError(error) && error.status < 500) return [];
        throw error;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
}

/** Current session. `null` when logged out; errors other than 401 propagate. */
export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: async ({ signal }) => {
      try {
        return await api.get<Session>("/auth/me", { signal });
      } catch (error) {
        if (isApiError(error) && (error.status === 401 || error.status === 404)) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoginPayload) => api.post<Session>("/auth/login", payload),
    onSuccess: (session) => client.setQueryData(queryKeys.session, session),
  });
}

export function useRegister() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: RegisterPayload) => api.post<Session>("/auth/register", payload),
    onSuccess: (session) => client.setQueryData(queryKeys.session, session),
  });
}

export function useLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>("/auth/logout"),
    onSuccess: () => {
      client.setQueryData(queryKeys.session, null);
      void client.invalidateQueries();
    },
  });
}
