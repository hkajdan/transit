import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexAction } from "@convex-dev/react-query";
import { api } from "@repo/backend/api";
import Map from "@repo/ui/map";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  // const { data, isPending } = useQuery(
  //   convexAction(api.sncf.fetchSNCFStations, { limit: 100 }),
  // );
  return (
    <div>
      <Map />
    </div>
  );
}
