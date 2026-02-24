import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@repo/backend/api";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { data, isPending } = useQuery(convexQuery(api.test.test));
  return (
    <div className="p-2">
      <h3>Welcome Alix!</h3>
      <p>{isPending ? "Pending" : data}</p>
    </div>
  );
}
