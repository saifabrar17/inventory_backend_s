const express = require("express");
const router = express.Router();
const controller = require("./warehouse.controller");

const authMiddleware = require("../../middlewares/auth.middleware");
const permissionMiddleware = require("../../middlewares/permission.middleware");

router.post(
  "/",
  authMiddleware,
  permissionMiddleware("warehouse:create"),
  controller.createWarehouse
);

router.get(
  "/",
  authMiddleware,
  permissionMiddleware("warehouse:view"),
  controller.getWarehouses
);

router.put(
  "/:id",
  authMiddleware,
  permissionMiddleware("warehouse:create"),
  controller.updateWarehouse
);


module.exports = router;
