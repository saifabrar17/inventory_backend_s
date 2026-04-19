const { default: mongoose } = require("mongoose");
const Sale = require("../sales/sale.model");
const Purchase = require("../purchases/purchase.model");
const cloudinary = require("../../config/cloudinary");
const logAudit = require("../../utils/auditLogger");
const User = require("./user.model");
const bcrypt = require("bcryptjs");

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "Name, email, password and role are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      role,
    });
    // console.log("REQ USER:", req.user);
    // console.log("NEW USER:", newUser);
    await logAudit({
      action: "USER_CREATED",
      entityType: "User",
      entityId: newUser._id,
      performedBy: req.user.id,
      metadata: { role },
    });

    res.status(201).json({
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const totalRecords = await User.countDocuments();
    const users = await User.find()
      .select("-password")
      .populate("role", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      users,
      totalRecords,
      page,
      limit,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.getSingleUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select("-password")
      .populate("role", "name");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
exports.getSingleUserStats = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findById(id)
      .select("-password")
      .populate("role", "name");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Last 5 Sales
    const recentSales = await Sale.find({ createdBy: id })
      .sort({ createdAt: -1 })
      .limit(5);

    // Last 5 Purchases
    const recentPurchases = await Purchase.find({ createdBy: id })
      .sort({ createdAt: -1 })
      .limit(5);

    // Aggregated Sales Data (Revenue, Cost, Profit)
    const salesStats = await Sale.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(id) } },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $multiply: ["$items.quantity", "$items.sellingPrice"],
            },
          },
          totalCost: {
            $sum: {
              $multiply: ["$items.quantity", "$items.costPrice"],
            },
          },
          totalItemsSold: { $sum: "$items.quantity" },
          totalSales: { $addToSet: "$_id" },
        },
      },
      {
        $project: {
          totalRevenue: 1,
          totalCost: 1,
          totalProfit: { $subtract: ["$totalRevenue", "$totalCost"] },
          totalItemsSold: 1,
          totalSalesCount: { $size: "$totalSales" },
        },
      },
    ]);

    // Purchase Summary
    const purchaseStats = await Purchase.aggregate([
      { $match: { createdBy: new mongoose.Types.ObjectId(id) } },
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: 1 },
          lastPurchaseDate: { $max: "$createdAt" },
        },
      },
    ]);

    res.json({
      user,
      stats: {
        sales: salesStats[0] || {
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          totalItemsSold: 0,
          totalSalesCount: 0,
        },
        purchases: purchaseStats[0] || {
          totalPurchases: 0,
          lastPurchaseDate: null,
        },
      },
      recentSales,
      recentPurchases,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.updateOwnProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, address, currentPassword, newPassword } = req.body;

    const user = await User.findById(userId).populate({
      path: "role",
      populate: { path: "permissions" },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.name = name || user.name;
    user.phone = phone || user.phone;
    user.address = address || user.address;

    // password change
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          message: "Current password is required to change password",
        });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);

      if (!isMatch) {
        return res.status(400).json({
          message: "Current password is incorrect",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
    }

    // profile image update
    if (req.file) {
      if (user.profileImage?.publicId) {
        await cloudinary.uploader.destroy(user.profileImage.publicId);
      }

      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "ims_users" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );

        stream.end(req.file.buffer);
      });

      user.profileImage = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      };
    }

    await user.save();

    const permissions = user.role.permissions.map((p) => p.name);

    await logAudit({
      action: newPassword ? "USER_PASSWORD_CHANGED" : "USER_PROFILE_UPDATED",
      entityType: "User",
      entityId: user._id,
      performedBy: req.user.id,
    });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        profileImage: user.profileImage,
        role: user.role.name,
        permissions,
      },
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.adminUpdateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isActive } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // update role
    if (role) {
      user.role = role;
    }

    // update active status
    if (typeof isActive === "boolean") {
      user.isActive = isActive;
    }

    await user.save();

    await logAudit({
      action: "USER_ROLE_STATUS_UPDATED",
      entityType: "User",
      entityId: user._id,
      performedBy: req.user.id,
      metadata: {
        role,
        isActive,
      },
    });

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

