const express = require("express");
const router = express.Router();
const controller = require("./product.controller");
const upload = require("../../middlewares/upload.middleware");
const authMiddleware = require("../../middlewares/auth.middleware");
const permissionMiddleware = require("../../middlewares/permission.middleware");

router.post(
  "/",
  authMiddleware,
  permissionMiddleware("product:create"),
  upload.array("images", 5),
  controller.createProduct,
);

router.get(
  "/",
  authMiddleware,
  permissionMiddleware("product:view"),
  controller.getProducts,
);

router.put(
  "/:id",
  authMiddleware,
  permissionMiddleware("product:create"),
  upload.array("images", 5),
  controller.updateProduct,
);

router.get(
  "/:id",
  authMiddleware,
  permissionMiddleware("product:view"),
  controller.getSingleProduct,
);

router.delete(
  "/:id",
  authMiddleware,
  permissionMiddleware("product:delete"),
  controller.deleteProduct,
);

module.exports = router;
