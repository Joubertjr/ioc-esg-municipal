import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import agentsRouter from "./routes/agents.js";
import odsRouter from "./routes/ods.js";
import { generalLimiter } from "./middleware/rate-limit.js";

dotenv.config();

const app: Express = express();
const PORT = Number(process.env["PORT"] ?? 3000);

app.use(helmet());
app.use(
  cors({
    origin: process.env["ALLOWED_ORIGINS"]?.split(",") ?? ["http://localhost:5173"],
    credentials: true,
  }),
);
app.use(generalLimiter);
app.use(express.json({ limit: "10kb" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "ioc-esg-municipal",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use("/api/agents", agentsRouter);
app.use("/api/ods", odsRouter);

app.listen(PORT, () => {
  console.log(`IOC ESG Municipal API running on port ${PORT}`);
});

export default app;
