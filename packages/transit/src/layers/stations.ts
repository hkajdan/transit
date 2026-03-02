import type { GeoJsonLayerConfig } from "@repo/ui/map";
import type { StationFeatureCollection } from "../geo";

export function stationsLayer(
  data: StationFeatureCollection,
): GeoJsonLayerConfig {
  return {
    id: "stations",
    data,
    style: {
      type: "circle",
      paint: {
        "circle-radius": 2.5,
        "circle-color": "#0066CC",
      },
    },
  };
}
