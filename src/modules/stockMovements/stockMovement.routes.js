const express = require("express");
const router = express.Router();
const controller = require("./stockMovement.controller");

const authMiddleware = require("../../middlewares/auth.middleware");
const permissionMiddleware = require("../../middlewares/permission.middleware");

router.post(
  "/adjust",
  authMiddleware,
  permissionMiddleware("stock:adjust"),
  controller.adjustStock
);

router.get(
  "/:productId/:warehouseId",
  authMiddleware,
  permissionMiddleware("product:view"),
  controller.getCurrentStock
);

router.post(
  "/bulk",
  authMiddleware,
  permissionMiddleware("product:view"),
  controller.getBulkStock
);

module.exports = router;
