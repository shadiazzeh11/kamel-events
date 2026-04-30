import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import { eventsRouter } from "./routes/events.js";
import { analyticsRouter } from "./routes/analytics.js";
import { DB_FILE_PATH } from "./db.js";

const app = express();

app.use(cors());
app.use(express.json());

// Tiny request log so the dev terminal shows incoming hits without
// needing the browser DevTools panel. Cheap, reads naturally, and
// makes wiring up the frontend feel less like flying blind.
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use(eventsRouter);
app.use(analyticsRouter);

// Final-resort error middleware. Express 5 forwards async errors to
// this handler automatically — no need for an express-async-errors
// shim or a wrapper around every handler. The 4-arg form is how
// Express identifies it as an error handler.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`kamel-events server listening on http://localhost:${PORT}`);
  console.log(`Database: ${DB_FILE_PATH}`);
});
