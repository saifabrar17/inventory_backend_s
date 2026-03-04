const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = require("../config/db");

const Permission = require("../modules/permissions/permission.model");
const Role = require("../modules/roles/role.model");

const seed = async () => {
  await connectDB();

  console.log("Clearing old roles and permissions...");

  await Permission.deleteMany({});
  await Role.deleteMany({});

  console.log("Creating permissions...");

  const permissionsList = [
    "user:create",
    "category:create",
    "category:view",

    "warehouse:create",
    "warehouse:view",

    "product:create",
    "product:update",
    "product:delete",
    "product:view",

    "purchase:create",
    "purchase:view",

    "sale:create",
    "sale:view",
    "audit:view",
    "report:view",
  ];

  const permissionDocs = await Permission.insertMany(
    permissionsList.map((name) => ({ name })),
  );

  const permissionMap = {};
  permissionDocs.forEach((p) => {
    permissionMap[p.name] = p._id;
  });

  console.log("Permissions created");

  const adminRole = await Role.create({
    name: "ADMIN",
    permissions: permissionDocs.map((p) => p._id),
  });

  const managerPermissions = [
    "user:create",
    "category:create",
    "category:view",
    "warehouse:create",
    "warehouse:view",
    "product:create",
    "product:delete",
    "product:view",
    "purchase:view",
    "sale:view",
    "report:view",
    "audit:view",
  ].map((name) => permissionMap[name]);

  const managerRole = await Role.create({
    name: "MANAGER",
    permissions: managerPermissions,
  });

  const sellerPermissions = [
    "purchase:create",
    "purchase:view",
    "product:view",
    "warehouse:view",
    "sale:create",
    "sale:view",
  ].map((name) => permissionMap[name]);

  const sellerRole = await Role.create({
    name: "SELLER",
    permissions: sellerPermissions,
  });

  console.log("Roles created successfully");
  console.log("Seeding complete");

  process.exit();
};

seed();
