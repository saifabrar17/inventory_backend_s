const mongoose = require("mongoose");

const Product = require("../products/product.model");
const Sale = require("../sales/sale.model");
const User = require("../users/user.model");

exports.globalSearch = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === "") {
      return res.status(400).json({
        message: "Search query is required",
      });
    }

    const searchRegex = new RegExp(q, "i");

    // -------------------------
    // Products
    // -------------------------
    const products = await Product.find({
      isDeleted: false,
      $or: [
        { name: searchRegex },
        { sku: searchRegex },
      ],
    })
      .select("name sku sellingPrice images")
      .limit(5);

    // -------------------------
    // Sales (Invoice + Customer)
    // -------------------------
    const sales = await Sale.find({
      isDeleted: false,
      $or: [
        { invoiceNumber: searchRegex },
        { customerName: searchRegex },
        { customerPhone: searchRegex },
      ],
    })
      .select("invoiceNumber customerName totalRevenue createdAt")
      .sort({ createdAt: -1 })
      .limit(5);

    // -------------------------
    // Users
    // -------------------------
    const users = await User.find({
      $or: [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ],
    })
      .select("name email profileImage")
      .limit(5);

    res.json({
      products,
      sales,
      users,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};