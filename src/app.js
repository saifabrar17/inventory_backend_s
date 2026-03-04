require("dotenv").config();
const express = require("express");
const cors = require("cors");
const authRoutes = require("./modules/auth/auth.routes");
const authMiddleware = require("./middlewares/auth.middleware");
const roleMiddleware = require("./middlewares/role.middleware");
const auditRoutes = require("./modules/audit/audit.routes");
const userRoutes = require("./modules/users/user.route");
const roleRoutes = require("./modules/roles/role.routes");
const multer = require("multer");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "IMS API Running" });
});
app.use("/api/auth", authRoutes);

app.get("/api/protected", authMiddleware, (req, res) => {
  res.json({
    message: "You are authenticated",
    user: req.user,
  });
});

app.get(
  "/api/admin-only",
  authMiddleware,
  roleMiddleware("ADMIN"),
  (req, res) => {
    res.json({
      message: "Welcome Admin",
      user: req.user,
    });
  },
);
app.use("/api/audit", auditRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/users", userRoutes);

//for showing errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      message: err.message,
    });
  }

  if (err) {
    return res.status(500).json({
      message: err.message,
    });
  }

  next();
});
module.exports = app;
