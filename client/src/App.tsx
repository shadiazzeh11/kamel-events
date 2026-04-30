import type { Event } from "../../shared/types";

function App() {
  const exampleEvent: Event = {
    id: "placeholder",
    event_type: "search",
    user_id: "user_001",
    timestamp: new Date().toISOString(),
    properties: { campus: "Cornell" },
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-8">
      <h1 className="text-3xl font-bold text-neutral-900">
        kamel-events
      </h1>
      <p className="mt-2 text-neutral-600">
        Scaffold OK. Example event type: {exampleEvent.event_type}
      </p>
    </div>
  );
}

export default App;
