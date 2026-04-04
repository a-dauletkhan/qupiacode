import express from "express";
import { config } from "./config.js";

const app = express();
app.use(express.json());

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(config.server.port, () => {
  console.log(`AI Agent Service running on port ${config.server.port}`);
});
