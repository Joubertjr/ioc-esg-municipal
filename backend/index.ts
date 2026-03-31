import express, { type Express } from "express";
import cors from "cors";
import dotenv from "dotenv";
import agentsRouter from "./routes/agents.js";

dotenv.config();

const app: Express = express();
const PORT = Number(process.env["PORT"] ?? 3000);

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "ioc-esg-municipal",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use("/api/agents", agentsRouter);

app.listen(PORT, () => {
  console.log(`IOC ESG Municipal API running on port ${PORT}`);
});

export default app;
