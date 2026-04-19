const express = require("express");
const router = express.Router();

const controller = require("./search.controller");
const authMiddleware = require("../../middlewares/auth.middleware");

router.get(
  "/",
  authMiddleware,
  controller.globalSearch
);

module.exports = router;