const mongoose = require("mongoose");
const StockMovement = require("./stockMovement.model");

exports.adjustStock = async (req, res) => {
  const { product, warehouse, type, quantity, unitCost } = req.body;

  if (!["IN", "OUT"].includes(type)) {
    return res.status(400).json({ message: "Invalid movement type" });
  }

  if (quantity <= 0) {
    return res.status(400).json({ message: "Quantity must be positive" });
  }

  if (type === "OUT") {
    const result = await StockMovement.aggregate([
      {
        $match: {
          product: new mongoose.Types.ObjectId(product),
          warehouse: new mongoose.Types.ObjectId(warehouse),
        },
      },
      {
        $group: {
          _id: null,
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
    ]);

    const currentStock =
      result.length > 0 ? result[0].totalIn - result[0].totalOut : 0;

    if (quantity > currentStock) {
      return res.status(400).json({
        message: "Insufficient stock",
        availableStock: currentStock,
      });
    }
  }

  const movement = await StockMovement.create({
    product,
    warehouse,
    type,
    quantity,
    unitCost,
    referenceType: "ADJUSTMENT",
    createdBy: req.user.id,
  });

  res.status(201).json(movement);
};

exports.getCurrentStock = async (req, res) => {
  const { productId, warehouseId } = req.params;

  const result = await StockMovement.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        warehouse: new mongoose.Types.ObjectId(warehouseId),
      },
    },
    {
      $group: {
        _id: null,
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
  ]);

  const stock = result.length > 0 ? result[0].totalIn - result[0].totalOut : 0;

  res.json({ currentStock: stock });
};

exports.getBulkStock = async (req, res) => {
  try {
    const { warehouseId, productIds } = req.body;

    if (!warehouseId || !productIds || !Array.isArray(productIds)) {
      return res.status(400).json({
        message: "warehouseId and productIds array required",
      });
    }

    const warehouseObjectId = new mongoose.Types.ObjectId(warehouseId);
    const productObjectIds = productIds.map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    const stockData = await StockMovement.aggregate([
      {
        $match: {
          warehouse: warehouseObjectId,
          product: { $in: productObjectIds },
        },
      },
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
    ]);
// console.log("stock data:", stockData);
    // Ensure products with no movement return 0
    const stockMap = {};
    stockData.forEach((item) => {
      stockMap[item.productId.toString()] = item.currentStock;
    });

    const result = productIds.map((id) => ({
      productId: id,
      currentStock: stockMap[id] || 0,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
