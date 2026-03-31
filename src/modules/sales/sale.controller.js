const mongoose = require("mongoose");
const Sale = require("./sale.model");
const StockMovement = require("../stockMovements/stockMovement.model");
const Product = require("../products/product.model");
const logAudit = require("../../utils/auditLogger");

exports.createSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      warehouse,
      customerName,
      // customerPhone,
      customerAddress,
      items,
    } = req.body;

    // if (!customerName || !customerPhone) {
    //   throw new Error("Customer name and phone are required");
    // }

    const invoiceNumber = await generateInvoiceNumber();

    let totalRevenue = 0;
    let totalProfit = 0;
    const processedItems = [];

    for (const item of items) {
      const { product, quantity, sellingPrice } = item;

      const productDoc = await Product.findOne({
        _id: product,
        isDeleted: false,
      });

      if (!productDoc) {
        throw new Error("Product not found or deleted");
      }

      const stockData = await StockMovement.aggregate([
        {
          $match: {
            product: new mongoose.Types.ObjectId(product),
            warehouse: new mongoose.Types.ObjectId(warehouse),
          },
        },
        {
          $group: {
            _id: null,
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
      ]);

      const totalInQty = stockData[0]?.totalInQty || 0;
      const totalOutQty = stockData[0]?.totalOutQty || 0;
      const totalInValue = stockData[0]?.totalInValue || 0;

      const availableStock = totalInQty - totalOutQty;

      if (quantity > availableStock) {
        throw new Error("Insufficient stock");
      }

      const averageCost =
        totalInQty > 0 ? totalInValue / totalInQty : 0;

      const itemRevenue = quantity * sellingPrice;
      const itemCost = quantity * averageCost;
      const itemProfit = itemRevenue - itemCost;

      totalRevenue += itemRevenue;
      totalProfit += itemProfit;

      processedItems.push({
        product,
        quantity,
        sellingPrice,
        costPrice: averageCost,
        profit: itemProfit,
      });

      await StockMovement.create(
        [
          {
            product,
            warehouse,
            type: "OUT",
            quantity,
            unitCost: averageCost,
            referenceType: "SALE",
            createdBy: req.user.id,
          },
        ],
        { session }
      );
    }

    const sale = await Sale.create(
      [
        {
          invoiceNumber,
          warehouse,
          customerName,
          // customerPhone,
          customerAddress,
          items: processedItems,
          totalRevenue,
          totalProfit,
          createdBy: req.user.id,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    await logAudit({
      action: "SALE_CREATED",
      entityType: "Sale",
      entityId: sale[0]._id,
      performedBy: req.user.id,
      metadata: {
        invoiceNumber,
        totalRevenue,
        totalProfit,
      },
    });

    res.status(201).json(sale[0]);

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(400).json({ message: error.message });
  }
};
exports.getSales = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const filter = { isDeleted: false };

    const totalRecords = await Sale.countDocuments(filter);

    const sales = await Sale.find(filter)
      .populate("warehouse", "name")
      .populate("createdBy", "name email")
      .populate("items.product", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      data: sales,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSingleSale = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await Sale.findOne({
      _id: id,
      isDeleted: false
    })
      .populate("warehouse", "name")
      .populate("createdBy", "name email")
      .populate("items.product", "name");

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    res.json(sale);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateSale = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { warehouse, customerName, items } = req.body;

    const sale = await Sale.findById(id).session(session);

    if (!sale || sale.isDeleted) {
      throw new Error("Sale not found");
    }

    //Reverse previous stock OUT
    await StockMovement.deleteMany(
      {
        referenceType: "SALE",
        referenceId: sale._id
      },
      { session }
    );

    let totalRevenue = 0;
    let totalProfit = 0;
    const processedItems = [];

    for (const item of items) {
      const { product, quantity, sellingPrice } = item;

      const stockData = await StockMovement.aggregate([
        {
          $match: {
            product: new mongoose.Types.ObjectId(product),
            warehouse: new mongoose.Types.ObjectId(warehouse)
          }
        },
        {
          $group: {
            _id: null,
            totalIn: {
              $sum: {
                $cond: [{ $eq: ["$type", "IN"] }, "$quantity", 0]
              }
            },
            totalOut: {
              $sum: {
                $cond: [{ $eq: ["$type", "OUT"] }, "$quantity", 0]
              }
            }
          }
        }
      ]);

      const availableStock =
        (stockData[0]?.totalIn || 0) -
        (stockData[0]?.totalOut || 0);

      if (quantity > availableStock) {
        throw new Error("Insufficient stock");
      }

      totalRevenue += quantity * sellingPrice;

      processedItems.push({
        product,
        quantity,
        sellingPrice
      });

      await StockMovement.create(
        [{
          product,
          warehouse,
          type: "OUT",
          quantity,
          referenceType: "SALE",
          referenceId: sale._id,
          createdBy: req.user.id
        }],
        { session }
      );
    }

    sale.warehouse = warehouse;
    sale.customerName = customerName;
    sale.items = processedItems;
    sale.totalRevenue = totalRevenue;

    await sale.save({ session });

    await session.commitTransaction();
    session.endSession();

    await logAudit({
      action: "SALE_UPDATED",
      entityType: "Sale",
      entityId: sale._id,
      performedBy: req.user.id,
      metadata: { totalRevenue }
    });

    res.json(sale);

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(400).json({ message: error.message });
  }
};

const generateInvoiceNumber = async () => {
  const today = new Date();

  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");

  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  const countToday = await Sale.countDocuments({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  });

  const sequence = String(countToday + 1).padStart(3, "0");

  return `INV-${dateStr}-${sequence}`;
};