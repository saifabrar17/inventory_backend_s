const { buildDateFilter } = require("../../utils/dateFilter");
const Sale = require("../sales/sale.model");
const StockMovement = require("../stockMovements/stockMovement.model");
const mongoose = require("mongoose");

exports.getRevenueSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = buildDateFilter(startDate, endDate);

    const revenue = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalRevenue" },
        },
      },
    ]);

    res.json({
      totalRevenue: revenue[0]?.totalRevenue || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getInventoryValue = async (req, res) => {
  try {
    const stock = await StockMovement.aggregate([
      {
        $group: {
          _id: "$product",
          totalInQty: {
            $sum: {
              $cond: [{ $eq: ["$type", "IN"] }, "$quantity", 0],
            },
          },
          totalOutQty: {
            $sum: {
              $cond: [{ $eq: ["$type", "OUT"] }, "$quantity", 0],
            },
          },
          totalInValue: {
            $sum: {
              $cond: [
                { $eq: ["$type", "IN"] },
                { $multiply: ["$quantity", "$unitCost"] },
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          currentStock: { $subtract: ["$totalInQty", "$totalOutQty"] },
          averageCost: {
            $cond: [
              { $eq: ["$totalInQty", 0] },
              0,
              { $divide: ["$totalInValue", "$totalInQty"] },
            ],
          },
        },
      },
      {
        $project: {
          inventoryValue: {
            $multiply: ["$currentStock", "$averageCost"],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalInventoryValue: { $sum: "$inventoryValue" },
        },
      },
    ]);

    res.json({
      inventoryValue: stock[0]?.totalInventoryValue || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProductProfitReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = buildDateFilter(startDate, endDate);

    const profit = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalProfit: { $sum: "$totalProfit" },
        },
      },
    ]);

    res.json({
      totalProfit: profit[0]?.totalProfit || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSalesTrend = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = buildDateFilter(startDate, endDate);

    const trend = await Sale.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          revenue: { $sum: "$totalRevenue" },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1,
        },
      },
    ]);

    res.json(trend);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLowStock = async (req, res) => {
  try {
    const threshold = Number(req.query.threshold) || 5;

    const stock = await StockMovement.aggregate([
      {
        $group: {
          _id: "$product",
          totalIn: {
            $sum: {
              $cond: [{ $eq: ["$type", "IN"] }, "$quantity", 0],
            },
          },
          totalOut: {
            $sum: {
              $cond: [{ $eq: ["$type", "OUT"] }, "$quantity", 0],
            },
          },
        },
      },
      {
        $project: {
          productId: "$_id",
          currentStock: { $subtract: ["$totalIn", "$totalOut"] },
        },
      },
      {
        $match: {
          currentStock: { $lte: threshold },
        },
      },
    ]);

    res.json(stock);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRecentSales = async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;

    const sales = await Sale.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("warehouse", "name");

    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTopSellingProducts = async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;
    const max = Number(limit) || 10;

    const filter = buildDateFilter(startDate, endDate);

    const result = await Sale.aggregate([
      { $match: filter },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalSold: { $sum: "$items.quantity" },
          totalRevenue: {
            $sum: { $multiply: ["$items.quantity", "$items.sellingPrice"] },
          },
        },
      },
      { $sort: { totalSold: -1 } },
      { $limit: max },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          productId: "$product._id",
          productName: "$product.name",
          totalSold: 1,
          totalRevenue: 1,
        },
      },
    ]);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDeadStock = async (req, res) => {
  try {
    const days = Number(req.query.days) || 30;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await Product.aggregate([
      {
        $lookup: {
          from: "sales",
          localField: "_id",
          foreignField: "items.product",
          as: "sales",
        },
      },
      {
        $addFields: {
          lastSold: { $max: "$sales.createdAt" },
        },
      },
      {
        $match: {
          $or: [
            { lastSold: { $exists: false } },
            { lastSold: { $lt: cutoffDate } },
          ],
        },
      },
      {
        $project: {
          name: 1,
          sku: 1,
          lastSold: 1,
        },
      },
    ]);

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getInventoryMovement = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = buildDateFilter(startDate, endDate);

    const movement = await Sale.aggregate([
      { $match: filter },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          totalSold: { $sum: "$items.quantity" },
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          productId: "$product._id",
          productName: "$product.name",
          totalSold: 1,
          movementType: {
            $cond: [
              { $gte: ["$totalSold", 50] },
              "FAST_MOVING",
              {
                $cond: [
                  { $gte: ["$totalSold", 10] },
                  "MEDIUM_MOVING",
                  "SLOW_MOVING",
                ],
              },
            ],
          },
        },
      },
    ]);

    res.json(movement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProfitByProduct = async (req, res) => {
  try {

    const { startDate, endDate, limit } = req.query;
    const max = Number(limit) || 10;

    const filter = buildDateFilter(startDate, endDate);

    const result = await Sale.aggregate([
      { $match: filter },

      { $unwind: "$items" },

      {
        $group: {
          _id: "$items.product",
          totalProfit: { $sum: "$items.profit" },
          totalRevenue: {
            $sum: { $multiply: ["$items.quantity", "$items.sellingPrice"] }
          },
          totalSold: { $sum: "$items.quantity" }
        }
      },

      { $sort: { totalProfit: -1 } },

      { $limit: max },

      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product"
        }
      },

      { $unwind: "$product" },

      {
        $project: {
          productId: "$product._id",
          productName: "$product.name",
          totalProfit: 1,
          totalRevenue: 1,
          totalSold: 1
        }
      }

    ]);

    res.json(result);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSalesByCategory = async (req, res) => {
  try {

    const { startDate, endDate } = req.query;

    const filter = buildDateFilter(startDate, endDate);

    const result = await Sale.aggregate([
      { $match: filter },

      { $unwind: "$items" },

      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "product"
        }
      },

      { $unwind: "$product" },

      {
        $lookup: {
          from: "categories",
          localField: "product.category",
          foreignField: "_id",
          as: "category"
        }
      },

      { $unwind: "$category" },

      {
        $group: {
          _id: "$category._id",
          categoryName: { $first: "$category.name" },
          totalRevenue: {
            $sum: {
              $multiply: ["$items.quantity", "$items.sellingPrice"]
            }
          },
          totalSold: { $sum: "$items.quantity" }
        }
      },

      { $sort: { totalRevenue: -1 } }

    ]);

    res.json(result);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};