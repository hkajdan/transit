import type { GeoJsonLayerConfig } from "@repo/ui/map";
import type { RailwayFeatureCollection } from "../geo";

export function railwaysLayer(data: RailwayFeatureCollection): GeoJsonLayerConfig {
  return {
    id: "railways",
    data,
    style: {
      type: "line",
      paint: {
        "line-color": "#666666",
        "line-width": 1,
      },
    },
  };
}
