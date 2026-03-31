const logAudit = require("../../utils/auditLogger");
const Product = require("./product.model");
const cloudinary = require("../../config/cloudinary");
const StockMovement = require("../stockMovements/stockMovement.model");
const mongoose = require("mongoose");

exports.createProduct = async (req, res) => {
  try {
    let uploadedImages = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "ims_products" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            },
          );

          stream.end(file.buffer);
        });

        uploadedImages.push({
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        });
      }
    }

    const product = await Product.create({
      ...req.body,
      images: uploadedImages,
      createdBy: req.user.id,
    });

    await logAudit({
      action: "PRODUCT_CREATED",
      entityType: "Product",
      entityId: product._id,
      performedBy: req.user.id,
    });

    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;

    const result = await Product.aggregate([
      {
        $match: { isDeleted: false },
      },

      {
        $lookup: {
          from: "stockmovements",
          localField: "_id",
          foreignField: "product",
          as: "movements",
        },
      },

      {
        $addFields: {
          totalIn: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$movements",
                    as: "m",
                    cond: { $eq: ["$$m.type", "IN"] },
                  },
                },
                as: "inMove",
                in: "$$inMove.quantity",
              },
            },
          },

          totalOut: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$movements",
                    as: "m",
                    cond: { $eq: ["$$m.type", "OUT"] },
                  },
                },
                as: "outMove",
                in: "$$outMove.quantity",
              },
            },
          },
        },
      },

      {
        $addFields: {
          currentStock: {
            $subtract: [
              { $ifNull: ["$totalIn", 0] },
              { $ifNull: ["$totalOut", 0] },
            ],
          },
        },
      },

      {
        $project: {
          movements: 0,
          totalIn: 0,
          totalOut: 0,
        },
      },

      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ]);

    const products = result[0].data;
    const totalRecords = result[0].totalCount[0]?.count || 0;

    res.json({
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      data: products,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    let images = product.images || [];

    const removedImages = req.body?.removedImages
      ? JSON.parse(req.body.removedImages)
      : [];

    if (removedImages.length > 0) {
      images = images.filter((img) => !removedImages.includes(img.publicId));

      for (const publicId of removedImages) {
        await cloudinary.uploader.destroy(publicId);
      }
    }

    // upload new images
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: "ims_products" },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            },
          );

          stream.end(file.buffer);
        });

        images.push({
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
        });
      }
    }

    const updated = await Product.findByIdAndUpdate(
      id,
      {
        ...req.body,
        images,
        updatedBy: req.user.id,
      },
      { returnDocument: "after" },
    );

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSingleProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findOne({
      _id: id,
      isDeleted: false,
    })
      .populate("category", "name")
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    if (!product) {
      return res.status(404).json({
        message: "Product not found",
      });
    }

    const stockData = await StockMovement.aggregate([
      {
        $match: {
          product: new mongoose.Types.ObjectId(id),
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
    ]);

    const totalIn = stockData[0]?.totalIn || 0;
    const totalOut = stockData[0]?.totalOut || 0;

    const currentStock = totalIn - totalOut;

    res.json({
      ...product.toObject(),
      currentStock,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid product ID" });
  }

  const product = await Product.findOne({
    _id: id,
    isDeleted: false,
  });

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  // Calculate current stock
  const stockData = await StockMovement.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(id),
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
    stockData.length > 0 ? stockData[0].totalIn - stockData[0].totalOut : 0;

  if (currentStock > 0) {
    return res.status(400).json({
      message: "Cannot delete product. Stock still exists.",
      currentStock,
    });
  }

  // Soft delete
  product.isDeleted = true;
  product.deletedAt = new Date();
  product.deletedBy = req.user.id;

  await product.save();

  await logAudit({
    action: "PRODUCT_DELETED",
    entityType: "Product",
    entityId: product._id,
    performedBy: req.user.id,
  });

  res.json({ message: "Product deleted successfully" });
};
