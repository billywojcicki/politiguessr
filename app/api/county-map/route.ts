import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const SVG_W = 320;
const SVG_H = 220;
const PAD = 12;

// Cache in globalThis so HMR reloads don't re-read the 25MB file
declare global {
  // eslint-disable-next-line no-var
  var __county_features: GeoJSON.Feature[] | undefined;
}

function getFeatures(): GeoJSON.Feature[] {
  if (globalThis.__county_features) return globalThis.__county_features;
  const p = path.join(process.cwd(), "data", "counties.geojson");
  const gj = JSON.parse(fs.readFileSync(p, "utf-8")) as GeoJSON.FeatureCollection;
  globalThis.__county_features = gj.features;
  return globalThis.__county_features;
}

type Coord = [number, number];
type Ring = Coord[];
type Projector = (lng: number, lat: number) => Coord;

function getRings(geometry: GeoJSON.Geometry): Ring[] {
  if (geometry.type === "Polygon") return geometry.coordinates as Ring[];
  if (geometry.type === "MultiPolygon") return (geometry.coordinates as Ring[][]).flat();
  return [];
}

function makeProjector(features: GeoJSON.Feature[]): Projector {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;

  for (const f of features) {
    for (const ring of getRings(f.geometry)) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }

  const drawW = SVG_W - 2 * PAD;
  const drawH = SVG_H - 2 * PAD;
  // Preserve aspect ratio
  const scale = Math.min(drawW / (maxLng - minLng), drawH / (maxLat - minLat));
  const offsetX = PAD + (drawW - scale * (maxLng - minLng)) / 2;
  const offsetY = PAD + (drawH - scale * (maxLat - minLat)) / 2;

  return (lng, lat) => [
    offsetX + (lng - minLng) * scale,
    SVG_H - offsetY - (lat - minLat) * scale, // flip Y axis
  ];
}

function featureToPath(feature: GeoJSON.Feature, project: Projector): string {
  return getRings(feature.geometry)
    .map((ring) =>
      ring
        .map(([lng, lat], i) => {
          const [x, y] = project(lng, lat);
          return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join("") + "Z"
    )
    .join("");
}

export async function GET(req: NextRequest) {
  const fips = req.nextUrl.searchParams.get("fips");
  if (!fips || fips.length < 5) {
    return new NextResponse("Missing or invalid fips", { status: 400 });
  }

  const stateFips = fips.slice(0, 2);
  const allFeatures = getFeatures();
  const stateFeatures = allFeatures.filter(
    (f) => (f.properties as Record<string, string>)?.fips?.startsWith(stateFips)
  );

  if (stateFeatures.length === 0) {
    return new NextResponse("State not found", { status: 404 });
  }

  const project = makeProjector(stateFeatures);
  const target = stateFeatures.find(
    (f) => (f.properties as Record<string, string>)?.fips === fips
  );

  const margin = (target?.properties as Record<string, number>)?.margin ?? 0;
  const highlightFill = margin > 0.5 ? "#ef4444" : margin < -0.5 ? "#3b82f6" : "#a78bfa";
  const highlightStroke = margin > 0.5 ? "#fca5a5" : margin < -0.5 ? "#93c5fd" : "#c4b5fd";

  const otherPaths = stateFeatures
    .filter((f) => (f.properties as Record<string, string>)?.fips !== fips)
    .map(
      (f) =>
        `<path d="${featureToPath(f, project)}" fill="#1f2937" stroke="#4b5563" stroke-width="0.5"/>`
    )
    .join("");

  const targetPath = target
    ? `<path d="${featureToPath(target, project)}" fill="${highlightFill}" stroke="${highlightStroke}" stroke-width="1"/>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_W} ${SVG_H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
  ${otherPaths}
  ${targetPath}
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
