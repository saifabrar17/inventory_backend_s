const mongoose = require("mongoose");
const Audit = require("./audit.model");

exports.getAuditLogs = async (req, res) => {
  try {
    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Filters
    const {
      action,
      entityType,
      performedBy,
      startDate,
      endDate
    } = req.query;

    const filter = {};

    if (action) {
      filter.action = action;
    }

    if (entityType) {
      filter.entityType = entityType;
    }

    if (performedBy && mongoose.Types.ObjectId.isValid(performedBy)) {
      filter.performedBy = new mongoose.Types.ObjectId(performedBy);
    }

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }

      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    const totalRecords = await Audit.countDocuments(filter);

    const logs = await Audit.find(filter)
      .populate("performedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalRecords / limit);

    res.json({
      page,
      limit,
      totalRecords,
      totalPages,
      data: logs
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};