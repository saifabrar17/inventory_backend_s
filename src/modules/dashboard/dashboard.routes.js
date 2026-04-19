const express = require("express");
const router = express.Router();
const controller = require("./dashboard.controller");

const authMiddleware = require("../../middlewares/auth.middleware");
const permissionMiddleware = require("../../middlewares/permission.middleware");

router.get(
  "/dashboard",
  authMiddleware,
  permissionMiddleware("product:view"),
  controller.getDashboardSummary
);

router.get(
  "/revenue",
  authMiddleware,
  permissionMiddleware("report:view"),
  controller.getRevenueSummary
);

router.get(
  "/inventory-value",
  authMiddleware,
  permissionMiddleware("report:view"),
  controller.getInventoryValue
);

router.get(
  "/product-profit",
  authMiddleware,
  permissionMiddleware("report:view"),
  controller.getProductProfitReport
);

router.get(
  "/sales-trend",
  authMiddleware,
  permissionMiddleware("report:view"),
  controller.getSalesTrend
);

router.get(
  "/low-stock",
  authMiddleware,
  permissionMiddleware("report:view"),
  controller.getLowStock
);

router.get(
  "/recent-sales",
  authMiddleware,
  permissionMiddleware("report:view"),
  controller.getRecentSales
);

router.get(
  "/top-selling-products",
  authMiddleware,
  permissionMiddleware("report:view"),
  controller.getTopSellingProducts
);

router.get(
  "/dead-stock",
  authMiddleware,
  permissionMiddleware("report:view"),
  controller.getDeadStock
);

router.get(
  "/inventory-movement",
  authMiddleware,
  permissionMiddleware("report:view"),
  controller.getInventoryMovement
);

router.get(
  "/profit-by-product",
  authMiddleware,
  permissionMiddleware("report:view"),
  controller.getProfitByProduct
);
router.get(
  "/sales-by-category",
  authMiddleware,
  permissionMiddleware("report:view"),
  controller.getSalesByCategory
);

module.exports = router;