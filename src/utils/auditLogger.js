const Audit = require("../modules/audit/audit.model");

const logAudit = async ({
  action,
  entityType,
  entityId,
  performedBy,
  metadata = {},
}) => {
  await Audit.create({
    action,
    entityType,
    entityId,
    performedBy,
    metadata,
  });
};

module.exports = logAudit;
