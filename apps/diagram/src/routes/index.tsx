import { Counter } from "@repo/ui/counter";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="p-2">
      <h3>Welcome Alix!</h3>
      <Counter></Counter>
    </div>
  );
}
