const { default: mongoose } = require("mongoose");
const Warehouse = require("./warehouse.model");
const logAudit = require("../../utils/auditLogger");

exports.createWarehouse = async (req, res) => {
  const warehouse = await Warehouse.create({
    ...req.body,
    createdBy: req.user.id,
  });
  await logAudit({
    action: "WAREHOUSE_CREATED",
    entityType: "Warehouse",
    entityId: warehouse._id,
    performedBy: req.user.id,
  });
  res.status(201).json(warehouse);
};

exports.getWarehouses = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const totalRecords = await Warehouse.countDocuments();
  const warehouses = await Warehouse.find()
    .populate("createdBy", "name email")
    .skip(skip)
    .limit(limit);
  res.json({
    warehouses,
    totalRecords,
    page,
    limit,
  });
};

exports.updateWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid warehouse ID",
      });
    }

    const warehouse = await Warehouse.findById(id);

    if (!warehouse) {
      return res.status(404).json({
        message: "Warehouse not found",
      });
    }

    if (name) warehouse.name = name;
    if (location) warehouse.location = location;

    warehouse.updatedBy = req.user.id;

    await warehouse.save();

    const updatedWarehouse = await Warehouse.findById(warehouse._id).populate(
      "createdBy",
      "name email",
    );

    await logAudit({
      action: "WAREHOUSE_UPDATED",
      entityType: "Warehouse",
      entityId: warehouse._id,
      performedBy: req.user.id,
    });

    res.json(updatedWarehouse);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
