const express = require("express");
const router = express.Router();

const controller = require("./audit.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const permissionMiddleware = require("../../middlewares/permission.middleware");

// GET /api/audit
router.get(
  "/",
  authMiddleware,
  permissionMiddleware("audit:view"),
  controller.getAuditLogs
);

module.exports = router;