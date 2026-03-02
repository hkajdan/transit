import type { Doc } from "../_generated/dataModel";
import type { StationFeatureCollection } from "@repo/domain/geo";

/**
 * Filters for passenger stations and converts to GeoJSON FeatureCollection.
 */
export function toGeoJSON(
  stations: Doc<"stations">[],
): StationFeatureCollection {
  return {
    type: "FeatureCollection",
    features: stations
      .filter((s) => s.voyageurs === "O")
      .map((s) => s.geo_shape as unknown as StationFeatureCollection["features"][number]),
  };
}

export function isPassengerStation(station: Doc<"stations">): boolean {
  return station.voyageurs === "O";
}
