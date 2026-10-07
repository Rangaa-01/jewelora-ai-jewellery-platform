import { AppointmentCta } from "@/components/home/appointment-cta";
import { BridalSection } from "@/components/home/bridal-section";
import { CollectionsGrid } from "@/components/home/collections-grid";
import { CustomerLooks } from "@/components/home/customer-looks";
import { Experience3D } from "@/components/home/experience-3d";
import { FeaturedProducts } from "@/components/home/featured-products";
import { FinalCta } from "@/components/home/final-cta";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { StylistTeaser } from "@/components/home/stylist-teaser";
import { Testimonials } from "@/components/home/testimonials";
import { Trust } from "@/components/home/trust";
import { TryOnIntro } from "@/components/home/tryon-intro";
import { VisualSearchTeaser } from "@/components/home/visual-search-teaser";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TryOnIntro />
      <FeaturedProducts />
      <CollectionsGrid />
      <Experience3D />
      <HowItWorks />
      <BridalSection />
      <StylistTeaser />
      <VisualSearchTeaser />
      <CustomerLooks />
      <AppointmentCta />
      <Testimonials />
      <Trust />
      <FinalCta />
    </>
  );
}
