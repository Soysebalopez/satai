// NOTE: dangerouslySetInnerHTML used intentionally for JSON-LD SEO.
// All data is server-generated from hardcoded zone definitions — no user input.
import type { Zone } from "@/lib/zones";

export function BarrioJsonLd({ zone, description }: { zone: Zone; description: string }) {
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${zone.name}, Bahia Blanca`,
    description,
    geo: { "@type": "GeoCoordinates", latitude: zone.lat, longitude: zone.lng },
    containedInPlace: {
      "@type": "City",
      name: "Bahia Blanca",
      containedInPlace: { "@type": "Country", name: "Argentina" },
    },
  });

  // eslint-disable-next-line react/no-danger -- JSON-LD requires innerHTML, data is hardcoded
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />;
}
