const express = require("express");
const router = express.Router();
const controller = require("./purchase.controller");

const authMiddleware = require("../../middlewares/auth.middleware");
const permissionMiddleware = require("../../middlewares/permission.middleware");

router.post(
  "/",
  authMiddleware,
  permissionMiddleware("purchase:create"),
  controller.createPurchase
);

router.get(
  "/all",
  authMiddleware,
  permissionMiddleware("purchase:create"),
  controller.getPurchases
);

router.get(
  "/:id",
  authMiddleware,
  permissionMiddleware("purchase:create"),
  controller.getSinglePurchase
);

router.put(
  "/update/:id",
  authMiddleware,
  permissionMiddleware("purchase:create"),
  controller.updatePurchase
);

module.exports = router;