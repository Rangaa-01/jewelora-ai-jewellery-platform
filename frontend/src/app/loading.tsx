import { Skeleton } from "@/components/ui/skeleton";
import { Container, Section } from "@/components/ui/layout";

export default function Loading() {
  return (
    <Section padding="md" aria-busy="true" aria-label="Loading">
      <Container>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-10 w-2/3 max-w-lg" />
        <Skeleton className="mt-3 h-4 w-1/2 max-w-md" />
        <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-md" />
          ))}
        </div>
      </Container>
    </Section>
  );
}
