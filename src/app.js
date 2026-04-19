require("dotenv").config();
const express = require("express");
const cors = require("cors");
const authRoutes = require("./modules/auth/auth.routes");
const authMiddleware = require("./middlewares/auth.middleware");
const roleMiddleware = require("./middlewares/role.middleware");
const searchRoutes = require("./modules/search/search.routes");
const categoryRoutes = require("./modules/categories/category.routes");
const productRoutes = require("./modules/products/product.routes");
const warehouseRoutes = require("./modules/warehouses/warehouse.routes");
const stockMovementRoutes = require("./modules/stockMovements/stockMovement.routes");
const purchaseRoutes = require("./modules/purchases/purchase.routes");
const saleRoutes = require("./modules/sales/sale.routes");
const auditRoutes = require("./modules/audit/audit.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
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

app.use("/api/search", searchRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/stock", stockMovementRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/dashboard", dashboardRoutes);
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
