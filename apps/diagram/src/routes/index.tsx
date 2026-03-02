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
  const { data } = useQuery(
    convexQuery(api.stations.queries.getStations, { limit: 7000 }),
  );

  const mapLayers: GeoJsonLayerConfig[] = data
    ? [
        {
          id: "stations",
          data: data,
          style: {
            type: "circle",
            paint: {
              "circle-radius": 2.5,
              "circle-color": "#0066CC",
            },
          },
        },
      ]
    : [];

  return (
    <div className="w-full h-screen">
      <Map center={[2.3513, 46.8575]} zoom={5.3} layers={mapLayers} />
    </div>
  );
}
