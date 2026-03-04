const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: {
      type: String,
      unique: true
    },
    password: String,
    phone: String,
    address: String,
    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role"
    },
    profileImage: {
      url: String,
      publicId: String
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);