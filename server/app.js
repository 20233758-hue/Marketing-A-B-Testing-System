import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import experimentRoutes from "./routes/experiments.js";
import trackRoutes from "./routes/track.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/experiments", experimentRoutes);
app.use("/api/track", trackRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  return res.status(500).json({ error: "An unexpected server error occurred." });
});

export default app;
