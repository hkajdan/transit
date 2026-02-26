import { createFileRoute } from "@tanstack/react-router";
import Map from "@repo/ui/map";
import type { GeoJsonLayerConfig } from "@repo/ui/map";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@repo/backend/api";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { data } = useQuery(convexQuery(api.sncf.getStations));

  const mapLayers: GeoJsonLayerConfig[] = data
    ? [
        {
          id: "stations",
          data: data,
          style: {
            type: "circle",
            paint: {
              "circle-radius": 8,
              "circle-color": "#FF0000",
            },
          },
        },
      ]
    : [];

  return (
    <div className="w-full h-screen">
      <Map center={[2.3513, 48.8575]} zoom={12} layers={mapLayers} />
    </div>
  );
}
