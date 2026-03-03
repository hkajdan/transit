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

export interface LineStringGeometry {
  type: "LineString";
  coordinates: [number, number][];
}

export interface RailwayFeature {
  type: "Feature";
  geometry: LineStringGeometry;
  properties: {
    line_code: string;
    railway_type: string;
    name: string;
    is_active: boolean;
  };
}

export interface RailwayFeatureCollection {
  type: "FeatureCollection";
  features: RailwayFeature[];
}
