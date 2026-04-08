import { NextRequest, NextResponse } from "next/server";
import { fetchSentinelImage, type SatelliteLayer } from "@/lib/sentinel-hub";

/**
 * GET /api/satellite?layer=trueColor|ndvi|moisture
 *
 * Returns a Sentinel-2 processed image (PNG) for Bahía Blanca.
 * Uses Sentinel Hub Process API with evalscripts for different visualizations.
 */
export async function GET(request: NextRequest) {
  const layer = (request.nextUrl.searchParams.get("layer") || "trueColor") as SatelliteLayer;

  const validLayers: SatelliteLayer[] = ["trueColor", "ndvi", "moisture"];
  if (!validLayers.includes(layer)) {
    return NextResponse.json(
      { error: `Capa invalida. Opciones: ${validLayers.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const imageBuffer = await fetchSentinelImage({
      layer,
      width: 1024,
      height: 1024,
      maxCloudCoverage: 30,
    });

    return new NextResponse(new Uint8Array(imageBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=7200",
      },
    });
  } catch (error) {
    console.error("Satellite API error:", error);
    return NextResponse.json(
      { error: "No se pudo obtener la imagen satelital" },
      { status: 502 }
    );
  }
}
