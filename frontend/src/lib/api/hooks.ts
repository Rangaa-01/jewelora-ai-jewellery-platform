"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, buildQuery, isApiError } from "./client";
import type {
  Appointment,
  AppointmentPayload,
  AppointmentSlot,
  Cart,
  CartItemPayload,
  Category,
  ChangePasswordPayload,
  Collection,
  CustomerProfile,
  CustomerProfileUpdate,
  Enquiry,
  EnquiryPayload,
  LoginPayload,
  Order,
  OrderPayload,
  Page,
  PaymentConfirmPayload,
  ProductDetail,
  ProductFilters,
  ProductSummary,
  PublicLook,
  RegisterPayload,
  SavedLook,
  SavedLookPayload,
  SavedLookUpdatePayload,
  Session,
  Store,
  StylistPayload,
  StylistResponse,
  VisualSearchResponse,
  Wishlist,
  WishlistItem,
  WishlistItemPayload,
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

// --- Shop ---------------------------------------------------------------------------------

export const shopKeys = {
  cart: (owner: string) => ["cart", owner] as const,
  wishlist: (owner: string) => ["wishlist", owner] as const,
  sharedWishlist: (token: string) => ["wishlist", "shared", token] as const,
  looks: (owner: string) => ["looks", "mine", owner] as const,
  sharedLook: (token: string) => ["looks", "shared", token] as const,
  appointments: (owner: string) => ["appointments", owner] as const,
  slots: (storeId: string, day: string) => ["appointments", "slots", storeId, day] as const,
  enquiries: (owner: string) => ["enquiries", owner] as const,
  orders: (owner: string) => ["orders", owner] as const,
  order: (owner: string, id: string) => ["orders", owner, id] as const,
  profile: (owner: string) => ["profile", owner] as const,
};

/** Stable identity used to scope per-user caches: changes on sign-in/out so data refetches. */
export function useOwnerKey(): { owner: string; signedIn: boolean; pending: boolean } {
  const session = useSession();
  return {
    owner: session.data?.user.id ?? "guest",
    signedIn: !!session.data,
    pending: session.isPending,
  };
}

// Cart (works for guests through the session cookie; merges into the account on sign-in)

export function useCart() {
  const { owner, pending } = useOwnerKey();
  return useQuery({
    queryKey: shopKeys.cart(owner),
    queryFn: ({ signal }) => api.get<Cart>("/cart", { signal }),
    enabled: !pending,
    staleTime: 15_000,
  });
}

function useCartMutation<TVariables>(run: (variables: TVariables) => Promise<Cart>) {
  const client = useQueryClient();
  const { owner } = useOwnerKey();
  return useMutation({
    mutationFn: run,
    onSuccess: (cart) => client.setQueryData(shopKeys.cart(owner), cart),
  });
}

export function useAddToCart() {
  return useCartMutation((payload: CartItemPayload) => api.post<Cart>("/cart/items", payload));
}

export function useUpdateCartItem() {
  return useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number }) =>
    api.patch<Cart>(`/cart/items/${itemId}`, { quantity }),
  );
}

export function useRemoveCartItem() {
  return useCartMutation((itemId: string) => api.delete<Cart>(`/cart/items/${itemId}`));
}

// Wishlist (signed-in customers only)

export function useWishlist() {
  const { owner, signedIn } = useOwnerKey();
  return useQuery({
    queryKey: shopKeys.wishlist(owner),
    queryFn: ({ signal }) => api.get<Wishlist>("/wishlist", { signal }),
    enabled: signedIn,
    staleTime: 15_000,
  });
}

export function useAddWishlistItem() {
  const client = useQueryClient();
  const { owner } = useOwnerKey();
  return useMutation({
    mutationFn: (payload: WishlistItemPayload) =>
      api.post<WishlistItem>("/wishlist/items", payload),
    onSuccess: () => client.invalidateQueries({ queryKey: shopKeys.wishlist(owner) }),
  });
}

export function useRemoveWishlistItem() {
  const client = useQueryClient();
  const { owner } = useOwnerKey();
  return useMutation({
    mutationFn: (itemId: string) => api.delete<{ message: string }>(`/wishlist/items/${itemId}`),
    onSuccess: () => client.invalidateQueries({ queryKey: shopKeys.wishlist(owner) }),
  });
}

export function useShareWishlist() {
  const client = useQueryClient();
  const { owner } = useOwnerKey();
  return useMutation({
    mutationFn: () => api.post<Wishlist>("/wishlist/share"),
    onSuccess: (wishlist) => client.setQueryData(shopKeys.wishlist(owner), wishlist),
  });
}

export function useSharedWishlist(token: string) {
  return useQuery({
    queryKey: shopKeys.sharedWishlist(token),
    queryFn: ({ signal }) =>
      api.get<Wishlist>(`/wishlist/shared/${encodeURIComponent(token)}`, { signal }),
    retry: false,
  });
}

// Saved looks

export function useLooks() {
  const { owner, signedIn } = useOwnerKey();
  return useQuery({
    queryKey: shopKeys.looks(owner),
    queryFn: ({ signal }) => api.get<SavedLook[]>("/looks", { signal }),
    enabled: signedIn,
  });
}

function useLookMutation<TVariables>(run: (variables: TVariables) => Promise<SavedLook>) {
  const client = useQueryClient();
  const { owner } = useOwnerKey();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: shopKeys.looks(owner) });
      void client.invalidateQueries({ queryKey: ["looks", "public"] });
    },
  });
}

export function useCreateLook() {
  return useLookMutation((payload: SavedLookPayload) => api.post<SavedLook>("/looks", payload));
}

export function useUpdateLook() {
  return useLookMutation(({ id, ...payload }: SavedLookUpdatePayload & { id: string }) =>
    api.patch<SavedLook>(`/looks/${id}`, payload),
  );
}

export function useShareLook() {
  return useLookMutation(({ id, channel }: { id: string; channel: string }) =>
    api.post<SavedLook>(`/looks/${id}/share${buildQuery({ channel })}`),
  );
}

export function useDeleteLook() {
  const client = useQueryClient();
  const { owner } = useOwnerKey();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ message: string }>(`/looks/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: shopKeys.looks(owner) }),
  });
}

export function useSharedLook(token: string) {
  return useQuery({
    queryKey: shopKeys.sharedLook(token),
    queryFn: ({ signal }) =>
      api.get<PublicLook>(`/looks/shared/${encodeURIComponent(token)}`, { signal }),
    retry: false,
  });
}

// Appointments & enquiries

export function useAppointmentSlots(storeId: string | null, day: string | null) {
  return useQuery({
    queryKey: shopKeys.slots(storeId ?? "", day ?? ""),
    queryFn: ({ signal }) =>
      api.get<AppointmentSlot[]>(`/appointments/slots${buildQuery({ store_id: storeId, day })}`, {
        signal,
      }),
    enabled: !!storeId && !!day,
    staleTime: 30_000,
  });
}

export function useBookAppointment() {
  const client = useQueryClient();
  const { owner } = useOwnerKey();
  return useMutation({
    mutationFn: (payload: AppointmentPayload) => api.post<Appointment>("/appointments", payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: shopKeys.appointments(owner) });
      void client.invalidateQueries({ queryKey: ["appointments", "slots"] });
    },
  });
}

export function useAppointments() {
  const { owner, signedIn } = useOwnerKey();
  return useQuery({
    queryKey: shopKeys.appointments(owner),
    queryFn: ({ signal }) => api.get<Appointment[]>("/appointments", { signal }),
    enabled: signedIn,
  });
}

export function useCancelAppointment() {
  const client = useQueryClient();
  const { owner } = useOwnerKey();
  return useMutation({
    mutationFn: (id: string) => api.post<Appointment>(`/appointments/${id}/cancel`),
    onSuccess: () => client.invalidateQueries({ queryKey: shopKeys.appointments(owner) }),
  });
}

export function useCreateEnquiry() {
  const client = useQueryClient();
  const { owner } = useOwnerKey();
  return useMutation({
    mutationFn: (payload: EnquiryPayload) => api.post<Enquiry>("/enquiries", payload),
    onSuccess: () => client.invalidateQueries({ queryKey: shopKeys.enquiries(owner) }),
  });
}

export function useEnquiries() {
  const { owner, signedIn } = useOwnerKey();
  return useQuery({
    queryKey: shopKeys.enquiries(owner),
    queryFn: ({ signal }) => api.get<Enquiry[]>("/enquiries", { signal }),
    enabled: signedIn,
  });
}

// Orders

export function useOrders() {
  const { owner, signedIn } = useOwnerKey();
  return useQuery({
    queryKey: shopKeys.orders(owner),
    queryFn: ({ signal }) => api.get<Order[]>("/orders", { signal }),
    enabled: signedIn,
  });
}

export function useOrder(id: string) {
  const { owner, signedIn } = useOwnerKey();
  return useQuery({
    queryKey: shopKeys.order(owner, id),
    queryFn: ({ signal }) => api.get<Order>(`/orders/${encodeURIComponent(id)}`, { signal }),
    enabled: signedIn,
    retry: false,
  });
}

export function usePlaceOrder() {
  const client = useQueryClient();
  const { owner } = useOwnerKey();
  return useMutation({
    mutationFn: (payload: OrderPayload) => api.post<Order>("/orders", payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: shopKeys.orders(owner) });
      void client.invalidateQueries({ queryKey: shopKeys.cart(owner) });
    },
  });
}

export function useConfirmPayment() {
  const client = useQueryClient();
  const { owner } = useOwnerKey();
  return useMutation({
    mutationFn: ({ orderId, ...payload }: PaymentConfirmPayload & { orderId: string }) =>
      api.post<Order>(`/orders/${orderId}/confirm-payment`, payload),
    onSuccess: () => client.invalidateQueries({ queryKey: shopKeys.orders(owner) }),
  });
}

export function useCancelOrder() {
  const client = useQueryClient();
  const { owner } = useOwnerKey();
  return useMutation({
    mutationFn: (id: string) => api.post<Order>(`/orders/${id}/cancel`),
    onSuccess: (order) => {
      client.setQueryData(shopKeys.order(owner, order.id), order);
      void client.invalidateQueries({ queryKey: shopKeys.orders(owner) });
    },
  });
}

// AI features

export function useStylist() {
  return useMutation({
    mutationFn: (payload: StylistPayload) =>
      api.post<StylistResponse>("/stylist/recommend", payload),
  });
}

export function useVisualSearch() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("image", file);
      return api.upload<VisualSearchResponse>("/visual-search", form);
    },
  });
}

// Profile

export function useProfile() {
  const { owner, signedIn } = useOwnerKey();
  return useQuery({
    queryKey: shopKeys.profile(owner),
    queryFn: ({ signal }) => api.get<CustomerProfile>("/customers/me", { signal }),
    enabled: signedIn,
  });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  const { owner } = useOwnerKey();
  return useMutation({
    mutationFn: (payload: CustomerProfileUpdate) =>
      api.patch<CustomerProfile>("/customers/me", payload),
    onSuccess: (profile) => {
      client.setQueryData(shopKeys.profile(owner), profile);
      void client.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) =>
      api.post<{ message: string }>("/auth/change-password", payload),
  });
}

export function useLogoutAll() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ message: string }>("/auth/logout-all"),
    onSuccess: () => {
      client.setQueryData(queryKeys.session, null);
      void client.invalidateQueries();
    },
  });
}
