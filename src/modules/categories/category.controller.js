const { default: mongoose } = require("mongoose");
const Category = require("./category.model.js");
const logAudit = require("../../utils/auditLogger.js");

exports.createCategory = async (req, res) => {
  const { name, parentCategory } = req.body;

  const category = await Category.create({
    name,
    parentCategory: parentCategory || null,
    createdBy: req.user.id,
  });

  await logAudit({
    action: "CATEGORY_CREATED",
    entityType: "Category",
    entityId: category._id,
    performedBy: req.user.id,
  });

  res.status(201).json(category);
};

exports.getCategories = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  const skip = (page - 1) * limit;

  const totalRecords = await Category.countDocuments();
  const categories = await Category.find()
    .populate("parentCategory", "name")
    .populate("createdBy", "name email")
    .skip(skip)
    .limit(limit);
  res.json({
    categories,
    totalRecords,
    page,
    limit,
  });
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parentCategory } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    if (name) category.name = name;
    if (parentCategory !== undefined) {
      category.parentCategory = parentCategory === "" ? null : parentCategory;
    }

    await category.save();

    const updatedCategory = await Category.findById(category._id)
      .populate("parentCategory", "name")
      .populate("createdBy", "name email");

    await logAudit({
      action: "CATEGORY_UPDATED",
      entityType: "Category",
      entityId: category._id,
      performedBy: req.user.id,
    });

    res.json(updatedCategory);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
