const express = require("express");
const router = express.Router();

const controller = require("./user.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const permissionMiddleware = require("../../middlewares/permission.middleware");
const upload = require("../../middlewares/upload.middleware");

router.post(
  "/",
  authMiddleware,
  permissionMiddleware("user:create"),
  controller.createUser
);
// View all users (admin only)
router.get(
  "/",
  authMiddleware,
  permissionMiddleware("user:create"),
  controller.getUsers
);

// View single user
router.get(
  "/:id",
  authMiddleware,
  permissionMiddleware("user:create"),
  controller.getSingleUser
);

// Edit own profile
router.put(
  "/me",
  authMiddleware,
  upload.single("profileImage"),
  controller.updateOwnProfile
);

// Admin edit user
router.put(
  "/:id",
  authMiddleware,
  permissionMiddleware("user:create"),
  controller.adminUpdateUser
);

module.exports = router;