import express from "express";
import cors from "cors";
import type { HealthResponse } from "../../shared/types.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("kamel-events server: ok");
});

app.get("/health", (_req, res) => {
  const response: HealthResponse = {
    ok: true,
    event_count: 0,
  };
  res.json(response);
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
