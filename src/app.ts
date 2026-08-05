import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./docs/openapi.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { childrenRouter } from "./routes/children.js";
import { immunizationsRouter } from "./routes/immunizations.js";
import { masterDataRouter } from "./routes/master-data.js";
import { measurementsRouter } from "./routes/measurements.js";
import { milestonesRouter } from "./routes/milestones.js";
import { remindersRouter } from "./routes/reminders.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requireAuth } from "./middleware/auth.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "Child Growth API",
    status: "ok",
    endpoints: {
      health: "/health",
      docs: "/docs",
      openApi: "/openapi.json",
      auth: "/api/auth/login",
      children: "/api/children",
      masterData: "/api/master-data/immunizations"
    }
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/master-data", requireAuth, masterDataRouter);
app.use("/api/children", requireAuth, childrenRouter);
app.use("/api/children/:childId/measurements", requireAuth, measurementsRouter);
app.use("/api/children/:childId/immunizations", requireAuth, immunizationsRouter);
app.use("/api/children/:childId/milestones", requireAuth, milestonesRouter);
app.use("/api/children/:childId/reminders", requireAuth, remindersRouter);

app.use(errorHandler);
