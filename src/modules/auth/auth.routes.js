const express = require("express");
const router = express.Router();
const controller = require("./auth.controller");
const upload = require("../../middlewares/upload.middleware");

router.post("/register", upload.single("profileImage"), controller.register);
router.post("/login", controller.login);
router.post("/refresh", controller.refreshAccessToken);
router.post("/logout", controller.logout);

module.exports = router;
