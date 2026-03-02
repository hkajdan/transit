import { createFileRoute } from "@tanstack/react-router";
import Map from "@repo/ui/map";
import { stationsLayer, railwaysLayer } from "@repo/transit/layers";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@repo/convex/api";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { data: stations } = useQuery(
    convexQuery(api.stations.queries.getStations, { limit: 7000 }),
  );
  const { data: railways } = useQuery(
    convexQuery(api.railways.queries.getRailways, {}),
  );

  const mapLayers = [
    ...(railways ? [railwaysLayer(railways)] : []),
    ...(stations ? [stationsLayer(stations)] : []),
  ];

  return (
    <div className="w-full h-screen">
      <Map center={[2.3513, 46.8575]} zoom={5.3} layers={mapLayers} />
    </div>
  );
}
