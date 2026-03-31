const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middlewares/auth.middleware");
const permissionMiddleware = require("../../middlewares/permission.middleware");
const controller = require("./category.controller");

router.post(
    "/",
    authMiddleware,
    permissionMiddleware("category:create"),
    controller.createCategory
);

router.get(
    "/",
    authMiddleware,
    permissionMiddleware("category:view"),
    controller.getCategories
);

router.put(
  "/:id",
  authMiddleware,
  permissionMiddleware("category:create"),
  controller.updateCategory
);

module.exports = router;
