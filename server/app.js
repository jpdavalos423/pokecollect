import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { runMigrations } from "./db/migrate.js";
import { pool } from "./db/pool.js";
import { authRouter } from "./routes/auth.js";
import { cardsRouter } from "./routes/cards.js";
import { collectionRouter } from "./routes/collection.js";
import { binderRouter } from "./routes/binder.js";

const app = express();

app.use(
  cors({
    origin: [/^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/],
    credentials: false,
  })
);

app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "pokecollect-api" });
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/cards", cardsRouter);
app.use("/api/v1/collection", collectionRouter);
app.use("/api/v1/binder", binderRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  await runMigrations();
  const server = app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });

  const shutdown = async () => {
    console.log("Shutting down API...");
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch((err) => {
  console.error("Failed to start API", err);
  process.exit(1);
});
