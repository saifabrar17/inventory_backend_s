const Role = require("./role.model");

exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find()
      .populate("permissions", "name")
      .sort({ createdAt: -1 });

    res.json(roles);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};