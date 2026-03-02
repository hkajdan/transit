/** GeoJSON types for transit map features */

export interface PointGeometry {
  type: "Point";
  coordinates: [longitude: number, latitude: number];
}

export interface StationFeature {
  type: "Feature";
  geometry: PointGeometry;
  properties: Record<string, unknown>;
}

export interface StationFeatureCollection {
  type: "FeatureCollection";
  features: StationFeature[];
}

export function featureCollection(
  features: StationFeature[],
): StationFeatureCollection {
  return { type: "FeatureCollection", features };
}
