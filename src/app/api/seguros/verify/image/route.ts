import { NextRequest, NextResponse } from "next/server";
import { fetchSentinelImage } from "@/lib/sentinel-hub";

/**
 * GET /api/seguros/verify/image?bbox=-62.3,-38.7,-62.2,-38.6&from=2026-03-01&to=2026-03-15
 *
 * Returns NDVI color image for a specific bbox and time range.
 * Used for before/after visual comparison in claim verification.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const bboxStr = params.get("bbox");
  const from = params.get("from");
  const to = params.get("to");

  if (!bboxStr || !from || !to) {
    return NextResponse.json({ error: "Requeridos: bbox, from, to" }, { status: 400 });
  }

  try {
    const imageBuffer = await fetchSentinelImage({
      layer: "ndvi",
      width: 512,
      height: 512,
      maxCloudCoverage: 50,
      fromDate: new Date(from + "T00:00:00Z").toISOString(),
      toDate: new Date(to + "T23:59:59Z").toISOString(),
    });

    return new NextResponse(new Uint8Array(imageBuffer), {
      headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
    });
  } catch (error) {
    console.error("Seguros image error:", error);
    return NextResponse.json({ error: "No se pudo obtener la imagen" }, { status: 502 });
  }
}
