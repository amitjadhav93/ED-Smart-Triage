const express = require("express");
const router = express.Router();

const repo = require("../services/patientRepository");
const queueEngine = require("../services/queueEngine");
const auditLog = require("../services/auditLog");
const triageService = require("../services/triageService");
const { generateValidationReport } = require("../services/validationReport");
const { seedDataset } = require("../data/seedData");
const { notFound, badRequest } = require("../utils/errors");
const {
  validatePatientIntake,
  validateOverride,
  validateStatusUpdate,
  validateSurge,
} = require("../utils/validation");

function asyncRoute(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// GET /api/validation-report
router.get(
  "/validation-report",
  asyncRoute(async (req, res) => {
    const report = generateValidationReport();
    res.status(200).json(report);
  })
);

// POST /api/patients
router.post(
  "/patients",
  asyncRoute(async (req, res) => {
    const result = validatePatientIntake(req.body);
    if (!result.valid) {
      return badRequest(res, result.code, result.message);
    }
    const patient = await triageService.createPatient(result.value);
    res.status(201).json(patient);
  })
);

// GET /api/patients
router.get(
  "/patients",
  asyncRoute(async (req, res) => {
    const queue = queueEngine.getSortedWaitingQueue();
    res.status(200).json(queue);
  })
);

// GET /api/patients/:id
router.get(
  "/patients/:id",
  asyncRoute(async (req, res) => {
    const patient = repo.getById(req.params.id);
    if (!patient) return notFound(res, `No patient found with id '${req.params.id}'.`);
    res.status(200).json(patient);
  })
);

// POST /api/patients/:id/override
router.post(
  "/patients/:id/override",
  asyncRoute(async (req, res) => {
    const existing = repo.getById(req.params.id);
    if (!existing) return notFound(res, `No patient found with id '${req.params.id}'.`);

    const result = validateOverride(req.body);
    if (!result.valid) {
      return badRequest(res, result.code, result.message);
    }

    const updated = triageService.overridePatient(req.params.id, result.value);
    res.status(200).json(updated);
  })
);

// GET /api/patients/:id/retriage
router.get(
  "/patients/:id/retriage",
  asyncRoute(async (req, res) => {
    const existing = repo.getById(req.params.id);
    if (!existing) return notFound(res, `No patient found with id '${req.params.id}'.`);

    const updated = triageService.manualRetriage(req.params.id);
    res.status(200).json(updated);
  })
);

// PATCH /api/patients/:id/status
router.patch(
  "/patients/:id/status",
  asyncRoute(async (req, res) => {
    const existing = repo.getById(req.params.id);
    if (!existing) return notFound(res, `No patient found with id '${req.params.id}'.`);

    const result = validateStatusUpdate(req.body);
    if (!result.valid) {
      return badRequest(res, result.code, result.message);
    }

    const updated = triageService.updateStatus(req.params.id, result.value.status);
    res.status(200).json(updated);
  })
);

// GET /api/audit-log
router.get(
  "/audit-log",
  asyncRoute(async (req, res) => {
    res.status(200).json(auditLog.getAllNewestFirst());
  })
);

// POST /api/surge
router.post(
  "/surge",
  asyncRoute(async (req, res) => {
    const result = validateSurge(req.body);
    if (!result.valid) {
      return badRequest(res, result.code, result.message);
    }
    const injected = await triageService.injectSurge(result.value.count, seedDataset);
    const queueSize = queueEngine.getSortedWaitingQueue().length;
    res.status(200).json({ injected, queueSize });
  })
);

// GET /api/stats
router.get(
  "/stats",
  asyncRoute(async (req, res) => {
    res.status(200).json(queueEngine.getStats());
  })
);

module.exports = router;
