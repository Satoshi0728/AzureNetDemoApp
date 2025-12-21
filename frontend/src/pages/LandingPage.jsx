import { Hero } from "../components/Hero.jsx";
import { FeaturesSection } from "../components/FeaturesSection.jsx";
import { APIsCatalogSection, ToolsCatalogSection } from "../components/EndpointCatalogSection.jsx";
import { useContent } from "../hooks/useContent.js";
import { useMetricCounter } from "../hooks/useMetricCounter.js";
import { useRevealOnScroll } from "../hooks/useRevealOnScroll.js";
import { usePointerParallax } from "../hooks/usePointerParallax.js";
import { useStickyHeader } from "../hooks/useStickyHeader.js";
import { useEndpointCatalog } from "../hooks/useEndpointCatalog.js";

export const LandingPage = () => {
  const { metrics } = useContent();
  const counterValues = useMetricCounter(metrics);
  const { endpoints, loading, error } = useEndpointCatalog();

  useRevealOnScroll();
  usePointerParallax();
  useStickyHeader();

  return (
    <main id="top">
      <Hero counterValues={counterValues} />
      <ToolsCatalogSection endpoints={endpoints} loading={loading} error={error} />
      <APIsCatalogSection endpoints={endpoints} loading={loading} error={error} />
      <FeaturesSection />
    </main>
  );
};
