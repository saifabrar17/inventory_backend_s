const User = require("../users/user.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Role = require("../roles/role.model");
const Permission = require("../permissions/permission.model");
const cloudinary = require("../../config/cloudinary");
const RefreshToken = require("./refreshToken.model");

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const hashed = await bcrypt.hash(password, 10);

    const defaultRole = await Role.findOne({ name: "USER" });

    let profileImage = null;

    if (req.file) {
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

      profileImage = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      };
    }

    const user = await User.create({
      name,
      email,
      password: hashed,
      role: defaultRole._id,
      profileImage,
    });

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).populate({
    path: "role",
    populate: { path: "permissions" },
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(400).json({ message: "Invalid credentials" });
  }

  const permissions = user.role.permissions.map((p) => p.name);

  const accessToken = jwt.sign(
    {
      id: user._id,
      role: user.role.name,
      permissions,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" },
  );

  await RefreshToken.create({
    user: user._id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  return res.json({
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      profileImage: user.profileImage,
      role: user.role.name,
      permissions,
    },
  });
};

exports.refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token required" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    const storedToken = await RefreshToken.findOne({
      token: refreshToken,
      user: decoded.id,
    });

    if (!storedToken) {
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    const user = await User.findById(decoded.id).populate({
      path: "role",
      populate: { path: "permissions" },
    });

    const permissions = user.role.permissions.map((p) => p.name);

    const newAccessToken = jwt.sign(
      {
        id: user._id,
        role: user.role.name,
        permissions,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    res.json({
      accessToken: newAccessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
        role: user.role.name,
        permissions,
      },
    });
  } catch (error) {
    return res
      .status(403)
      .json({ message: "Refresh token expired or invalid" });
  }
};

exports.logout = async (req, res) => {
  const { refreshToken } = req.body;

  await RefreshToken.deleteOne({ token: refreshToken });

  res.json({ message: "Logged out successfully" });
};

// exports.login = async (req, res) => {
//   const { email, password } = req.body;

//   const user = await User.findOne({ email }).populate({
//     path: "role",
//     populate: {
//       path: "permissions",
//     },
//   });
//   //console.log("USER WITH POPULATE:", JSON.stringify(user, null, 2));
//   if (!user) {
//     return res.status(400).json({ message: "Invalid credentials" });
//   }

//   const match = await bcrypt.compare(password, user.password);
//   if (!match) {
//     return res.status(400).json({ message: "Invalid credentials" });
//   }

//   const permissions = user.role.permissions.map((p) => p.name);

//   const token = jwt.sign(
//     {
//       id: user._id,
//       role: user.role.name,
//       permissions,
//     },
//     process.env.JWT_SECRET,
//     { expiresIn: "1m" },
//   );

//   res.json({ token });
// };
