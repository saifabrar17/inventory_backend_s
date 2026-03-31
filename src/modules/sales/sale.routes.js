const express = require("express");
const router = express.Router();
const controller = require("./sale.controller");

const authMiddleware = require("../../middlewares/auth.middleware");
const permissionMiddleware = require("../../middlewares/permission.middleware");

router.post(
  "/",
  authMiddleware,
  permissionMiddleware("sale:create"),
  controller.createSale
);

router.get(
  "/all",
  authMiddleware,
  permissionMiddleware("sale:create"),
  controller.getSales
);

router.get(
  "/:id",
  authMiddleware,
  permissionMiddleware("sale:create"),
  controller.getSingleSale
);

router.put(
  "/update/:id",
  authMiddleware,
  permissionMiddleware("sale:create"),
  controller.updateSale
);

module.exports = router;