const mongoose = require("mongoose");
const Purchase = require("./purchase.model");
const StockMovement = require("../stockMovements/stockMovement.model");
const logAudit = require("../../utils/auditLogger");

exports.createPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { supplierName, warehouse, currency, exchangeRateToBase, items } =
      req.body;

    let totalCost = 0;

    items.forEach((item) => {
      totalCost += item.quantity * item.unitCost;
    });

    const purchase = await Purchase.create(
      [
        {
          supplierName,
          warehouse,
          currency,
          exchangeRateToBase,
          items,
          totalCost,
          createdBy: req.user.id,
        },
      ],
      { session },
    );

    for (const item of items) {
      await StockMovement.create(
        [
          {
            product: item.product,
            warehouse,
            type: "IN",
            quantity: item.quantity,
            unitCost: item.unitCost,
            referenceType: "PURCHASE",
            referenceId: purchase[0]._id,
            createdBy: req.user.id,
          },
        ],
        { session },
      );
    }

    await session.commitTransaction();
    session.endSession();

    await logAudit({
      action: "PURCHASE_CREATED",
      entityType: "Purchase",
      entityId: purchase[0]._id,
      performedBy: req.user.id,
      metadata: {
        supplier: supplierName,
        totalCost,
      },
    });
    res.status(201).json(purchase[0]);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(500).json({ message: error.message });
  }
};

exports.getPurchases = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const totalRecords = await Purchase.countDocuments();

    const purchases = await Purchase.find({ isDeleted: false })
      .populate("warehouse", "name")
      .populate("createdBy", "name email")
      .populate("items.product", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      purchases,
      totalRecords,
      page,
      limit
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
    console.log(error);
  }
};

exports.getSinglePurchase = async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await Purchase.findOne({
      _id: id,
      isDeleted: false,
    })
      .populate("warehouse", "name")
      .populate("createdBy", "name email")
      .populate("items.product", "name");

    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    res.json(purchase);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updatePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { warehouse, supplierName, items } = req.body;

    const purchase = await Purchase.findById(id).session(session);

    if (!purchase || purchase.isDeleted) {
      throw new Error("Purchase not found");
    }

    //Reverse previous stock movements
    await StockMovement.deleteMany(
      {
        referenceType: "PURCHASE",
        referenceId: purchase._id,
      },
      { session },
    );

    let totalCost = 0;

    for (const item of items) {
      const { product, quantity, unitCost } = item;

      totalCost += quantity * unitCost;

      await StockMovement.create(
        [
          {
            product,
            warehouse,
            type: "IN",
            quantity,
            unitCost,
            referenceType: "PURCHASE",
            referenceId: purchase._id,
            createdBy: req.user.id,
          },
        ],
        { session },
      );
    }

    purchase.warehouse = warehouse;
    purchase.supplierName = supplierName;
    purchase.items = items;
    purchase.totalCost = totalCost;

    await purchase.save({ session });

    await session.commitTransaction();
    session.endSession();

    await logAudit({
      action: "PURCHASE_UPDATED",
      entityType: "Purchase",
      entityId: purchase._id,
      performedBy: req.user.id,
      metadata: { totalCost },
    });

    res.json(purchase);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    res.status(400).json({ message: error.message });
  }
};
