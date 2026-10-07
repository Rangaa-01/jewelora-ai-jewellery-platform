/**
 * Customer testimonials shown on the home page.
 * The shop owner replaces these entries with real, permissioned quotes before launch;
 * the UI reads only from this file.
 */
export interface Testimonial {
  quote: string;
  name: string;
  city: string;
  context: string;
}

export const testimonials: Testimonial[] = [
  {
    quote:
      "I tried eleven necklaces on my own photo in one evening and walked into the store knowing exactly which one. The fit on my photo matched what I saw in the mirror.",
    name: "Ananya R.",
    city: "Chennai",
    context: "Bridal haram",
  },
  {
    quote:
      "The AI stylist understood ‘temple jewellery under two lakh for a reception’ and every suggestion was actually in stock. We bought two of its three picks.",
    name: "Meera & Karthik",
    city: "Coimbatore",
    context: "Reception set",
  },
  {
    quote:
      "Seeing the ring in 3D and then on my hand through the camera made buying online feel safe. The size estimate was one off, which they confirmed in store.",
    name: "Divya S.",
    city: "Bengaluru",
    context: "Diamond solitaire",
  },
];
