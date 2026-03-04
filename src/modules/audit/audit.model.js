const mongoose = require("mongoose");

const auditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true
    },
    entityType: {
      type: String,
      required: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    metadata: {
      type: Object
    }
  },
  { timestamps: true }
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ action: 1 });
auditSchema.index({ entityType: 1 });
auditSchema.index({ performedBy: 1 });

module.exports = mongoose.model("Audit", auditSchema);