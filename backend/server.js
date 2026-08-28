// Load .env if present (dotenv is optional — don't crash if it's not installed).
try {
  require("dotenv").config();
} catch (e) {
  // no-op: environment variables can also be supplied directly by the host.
}

const express = require("express");
const cors = require("cors");

const apiRouter = require("./src/routes/api");
const { errorHandler } = require("./src/utils/errors");
const triageService = require("./src/services/triageService");

const app = express();

const PORT = process.env.PORT || 5000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({
    name: "ED Smart Triage Assistant — backend",
    status: "ok",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.use("/api", apiRouter);

// 404 for any unmatched route, in the same consistent error shape.
app.use((req, res) => {
  res.status(404).json({ error: { message: `No route matches ${req.method} ${req.originalUrl}`, code: "NOT_FOUND" } });
});

// Centralized error handler (catches anything thrown/passed to next()).
app.use(errorHandler);

// Module 4 — background overdue sweep. Runs every 30 seconds, re-scoring
// overdue waiting patients and logging auto-retriage audit entries per the
// override-preservation rule. Also computed on-the-fly on every GET via
// patientRepository.withLiveFields, so isOverdue is always accurate even
// between sweep ticks.
const AUTO_RETRIAGE_INTERVAL_MS = 30 * 1000;
setInterval(() => {
  try {
    triageService.runAutoRetriageSweep();
  } catch (err) {
    console.error("Auto-retriage sweep failed:", err);
  }
}, AUTO_RETRIAGE_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`ED Smart Triage backend listening on http://localhost:${PORT}`);
  console.log(`CORS allowed origin: ${FRONTEND_ORIGIN}`);
  console.log(`GEMINI_API_KEY set: ${Boolean(process.env.GEMINI_API_KEY)}`);
  if (!process.env.GEMINI_API_KEY) {
    console.log("No GEMINI_API_KEY found — AI intake interpretation will run in fallback (keyword-only) mode.");
  }
});

module.exports = app;
