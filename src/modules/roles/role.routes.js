const express = require("express");
const router = express.Router();

const controller = require("./role.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const permissionMiddleware = require("../../middlewares/permission.middleware");

router.get(
  "/",
  authMiddleware,
  permissionMiddleware("product:view"),
  controller.getRoles
);

module.exports = router;