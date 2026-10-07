"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildQuery, type QueryValue } from "@/lib/api/client";
import type {
  AdminCustomer,
  AdminCustomerDetail,
  AdminStore,
  AnalyticsOverview,
  Appointment,
  Category,
  CategoryInput,
  Collection,
  CollectionInput,
  Enquiry,
  Order,
  Page,
  ProductDetail,
  ProductFilters,
  ProductImage,
  ProductInput,
  ProductSummary,
  SavedLook,
  StaffInput,
  StoreInput,
  TryOnAsset,
  Model3DAsset,
  User,
} from "@/lib/api/types";

export const adminKeys = {
  overview: (days: number) => ["admin", "overview", days] as const,
  products: (filters: Record<string, QueryValue>) => ["admin", "products", filters] as const,
  product: (id: string) => ["admin", "product", id] as const,
  categories: ["admin", "categories"] as const,
  collections: ["admin", "collections"] as const,
  stores: ["admin", "stores"] as const,
  customers: (q: string, page: number) => ["admin", "customers", q, page] as const,
  customer: (id: string) => ["admin", "customer", id] as const,
  orders: (filters: Record<string, QueryValue>) => ["admin", "orders", filters] as const,
  order: (id: string) => ["admin", "order", id] as const,
  enquiries: (status: string, page: number) => ["admin", "enquiries", status, page] as const,
  appointments: (filters: Record<string, QueryValue>) => ["admin", "appointments", filters] as const,
  looks: (page: number) => ["admin", "looks", page] as const,
};

function useInvalidate() {
  const client = useQueryClient();
  return (...prefixes: readonly unknown[][]) =>
    Promise.all(prefixes.map((key) => client.invalidateQueries({ queryKey: key })));
}

// --- analytics -------------------------------------------------------------------------

export function useAdminOverview(days: number) {
  return useQuery({
    queryKey: adminKeys.overview(days),
    queryFn: ({ signal }) =>
      api.get<AnalyticsOverview>(`/admin/analytics/overview${buildQuery({ days })}`, { signal }),
    staleTime: 60_000,
  });
}

// --- products ----------------------------------------------------------------------------

export type AdminProductFilters = ProductFilters & { include_inactive?: boolean };

export function useAdminProducts(filters: AdminProductFilters) {
  const params = filters as Record<string, QueryValue>;
  return useQuery({
    queryKey: adminKeys.products(params),
    queryFn: ({ signal }) =>
      api.get<Page<ProductSummary>>(`/admin/products${buildQuery(params)}`, { signal }),
    placeholderData: (prev) => prev,
  });
}

export function useAdminProduct(id: string | null) {
  return useQuery({
    queryKey: adminKeys.product(id ?? ""),
    queryFn: ({ signal }) => api.get<ProductDetail>(`/admin/products/${id}`, { signal }),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: ProductInput) => api.post<ProductDetail>("/admin/products", input),
    onSuccess: () => invalidate(["admin", "products"], ["products"]),
  });
}

export function useUpdateProduct(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: Partial<ProductInput>) =>
      api.patch<ProductDetail>(`/admin/products/${id}`, input),
    onSuccess: () => invalidate(["admin", "products"], ["admin", "product", id], ["products"], ["product"]),
  });
}

export function useDeactivateProduct() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post<ProductDetail>(`/admin/products/${id}/deactivate`),
    onSuccess: () => invalidate(["admin", "products"], ["admin", "product"], ["products"]),
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ message: string }>(`/admin/products/${id}`),
    onSuccess: () => invalidate(["admin", "products"], ["products"]),
  });
}

type AssetKind = "images" | "tryon-assets" | "models";

export function useUploadAsset(productId: string, kind: AssetKind) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ file, meta }: { file: File; meta: Record<string, unknown> }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("meta", JSON.stringify(meta));
      return api.upload<ProductImage | TryOnAsset | Model3DAsset>(
        `/admin/products/${productId}/${kind}`,
        form,
      );
    },
    onSuccess: () => invalidate(["admin", "product", productId], ["admin", "products"], ["product"]),
  });
}

export function useDeleteAsset(productId: string, kind: AssetKind) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (assetId: string) =>
      api.delete<{ message: string }>(`/admin/products/${productId}/${kind}/${assetId}`),
    onSuccess: () => invalidate(["admin", "product", productId], ["admin", "products"], ["product"]),
  });
}

// --- categories / collections / stores ----------------------------------------------------

export function useAdminCategories() {
  return useQuery({
    queryKey: adminKeys.categories,
    queryFn: ({ signal }) => api.get<Category[]>("/admin/categories", { signal }),
  });
}

export function useSaveCategory() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CategoryInput }) =>
      id
        ? api.patch<Category>(`/admin/categories/${id}`, input)
        : api.post<Category>("/admin/categories", input),
    onSuccess: () => invalidate(["admin", "categories"], ["categories"]),
  });
}

export function useAdminCollections() {
  return useQuery({
    queryKey: adminKeys.collections,
    queryFn: ({ signal }) => api.get<Collection[]>("/admin/collections", { signal }),
  });
}

export function useSaveCollection() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CollectionInput }) =>
      id
        ? api.patch<Collection>(`/admin/collections/${id}`, input)
        : api.post<Collection>("/admin/collections", input),
    onSuccess: () => invalidate(["admin", "collections"], ["collections"]),
  });
}

export function useUploadCollectionHero() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      return api.upload<Collection>(`/admin/collections/${id}/hero-image`, form);
    },
    onSuccess: () => invalidate(["admin", "collections"], ["collections"]),
  });
}

export function useAdminStores() {
  return useQuery({
    queryKey: adminKeys.stores,
    queryFn: ({ signal }) => api.get<AdminStore[]>("/admin/stores", { signal }),
  });
}

export function useSaveStore() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: StoreInput }) =>
      id
        ? api.patch<AdminStore>(`/admin/stores/${id}`, input)
        : api.post<AdminStore>("/admin/stores", input),
    onSuccess: () => invalidate(["admin", "stores"], ["stores"]),
  });
}

// --- customers / staff ----------------------------------------------------------------------

export function useAdminCustomers(q: string, page: number) {
  return useQuery({
    queryKey: adminKeys.customers(q, page),
    queryFn: ({ signal }) =>
      api.get<Page<AdminCustomer>>(`/admin/customers${buildQuery({ q, page, page_size: 25 })}`, {
        signal,
      }),
    placeholderData: (prev) => prev,
  });
}

export function useAdminCustomer(id: string) {
  return useQuery({
    queryKey: adminKeys.customer(id),
    queryFn: ({ signal }) => api.get<AdminCustomerDetail>(`/admin/customers/${id}`, { signal }),
  });
}

export function useUpdateCustomer(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { notes?: string | null; is_active?: boolean }) =>
      api.patch<AdminCustomerDetail>(`/admin/customers/${id}`, input),
    onSuccess: () => invalidate(["admin", "customer", id], ["admin", "customers"]),
  });
}

export function useCreateStaff() {
  return useMutation({
    mutationFn: (input: StaffInput) => api.post<User>("/admin/staff", input),
  });
}

// --- orders / enquiries / appointments / looks ------------------------------------------------

export function useAdminOrders(filters: { status?: string; q?: string; page: number }) {
  const params: Record<string, QueryValue> = { ...filters, page_size: 25 };
  return useQuery({
    queryKey: adminKeys.orders(params),
    queryFn: ({ signal }) => api.get<Page<Order>>(`/admin/orders${buildQuery(params)}`, { signal }),
    placeholderData: (prev) => prev,
  });
}

export function useAdminOrder(id: string) {
  return useQuery({
    queryKey: adminKeys.order(id),
    queryFn: ({ signal }) => api.get<Order>(`/admin/orders/${id}`, { signal }),
  });
}

export function useUpdateOrder(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { status?: string; staff_notes?: string; mark_paid?: boolean }) =>
      api.patch<Order>(`/admin/orders/${id}`, input),
    onSuccess: () => invalidate(["admin", "order", id], ["admin", "orders"], ["admin", "overview"]),
  });
}

export function useAdminEnquiries(status: string, page: number) {
  return useQuery({
    queryKey: adminKeys.enquiries(status, page),
    queryFn: ({ signal }) =>
      api.get<Page<Enquiry>>(`/admin/enquiries${buildQuery({ status, page, page_size: 25 })}`, {
        signal,
      }),
    placeholderData: (prev) => prev,
  });
}

export function useUpdateEnquiry() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { status?: string; staff_notes?: string } }) =>
      api.patch<Enquiry>(`/admin/enquiries/${id}`, input),
    onSuccess: () => invalidate(["admin", "enquiries"], ["admin", "overview"]),
  });
}

export function useAdminAppointments(filters: {
  status?: string;
  store_id?: string;
  day?: string;
  page: number;
}) {
  const params: Record<string, QueryValue> = { ...filters, page_size: 25 };
  return useQuery({
    queryKey: adminKeys.appointments(params),
    queryFn: ({ signal }) =>
      api.get<Page<Appointment>>(`/admin/appointments${buildQuery(params)}`, { signal }),
    placeholderData: (prev) => prev,
  });
}

export function useUpdateAppointment() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { status?: string; staff_notes?: string } }) =>
      api.patch<Appointment>(`/admin/appointments/${id}`, input),
    onSuccess: () => invalidate(["admin", "appointments"], ["admin", "overview"]),
  });
}

export function useAdminLooks(page: number) {
  return useQuery({
    queryKey: adminKeys.looks(page),
    queryFn: ({ signal }) =>
      api.get<Page<SavedLook>>(`/admin/looks${buildQuery({ page, page_size: 24 })}`, { signal }),
    placeholderData: (prev) => prev,
  });
}
