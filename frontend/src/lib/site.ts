export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const SITE = {
  name: "Jewelora",
  tagline: "Try jewellery before you buy",
  description:
    "Jewelora lets you try necklaces, earrings, rings, bangles and complete bridal sets on your own photo or live camera, with AI styling, 3D viewing and in-store appointments.",
  locale: "en_IN",
  phone: "+91 00000 00000",
  email: "hello@jewelora.example",
  whatsapp: "https://wa.me/910000000000",
  instagram: "https://instagram.com/jewelora",
} as const;

export const NAV_LINKS = [
  { href: "/collections", label: "Collections" },
  { href: "/try-on", label: "Try On" },
  { href: "/bridal", label: "Bridal" },
  { href: "/stylist", label: "AI Stylist" },
  { href: "/visual-search", label: "Visual Search" },
  { href: "/appointments/new", label: "Book a Visit" },
] as const;

export const FOOTER_LINKS = {
  Shop: [
    { href: "/products", label: "All Jewellery" },
    { href: "/products?jewellery_type=necklace", label: "Necklaces" },
    { href: "/products?jewellery_type=earrings", label: "Earrings" },
    { href: "/products?jewellery_type=ring", label: "Rings" },
    { href: "/products?jewellery_type=bangle", label: "Bangles" },
    { href: "/bridal", label: "Bridal" },
  ],
  Experience: [
    { href: "/try-on", label: "Virtual Try-On" },
    { href: "/stylist", label: "AI Stylist" },
    { href: "/visual-search", label: "Visual Search" },
    { href: "/collections", label: "Collections" },
    { href: "/#how-it-works", label: "How It Works" },
  ],
  Account: [
    { href: "/account", label: "My Account" },
    { href: "/wishlist", label: "Wishlist" },
    { href: "/cart", label: "Bag" },
    { href: "/appointments/new", label: "Book a Visit" },
    { href: "/account/register", label: "Get updates" },
  ],
} as const;
