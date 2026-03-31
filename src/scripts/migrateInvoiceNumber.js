const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = require("../config/db");
const Sale = require("../modules/sales/sale.model");

const runMigration = async () => {
  await connectDB();

  console.log("Starting invoice migration...");

  // get all sales without invoiceNumber
  const sales = await Sale.find({
    $or: [
      { invoiceNumber: { $exists: false } },
      { invoiceNumber: null },
      { invoiceNumber: "" },
    ],
  }).sort({ createdAt: 1 }); 

  console.log(`Found ${sales.length} sales to update`);

  const counterMap = {}; 

  for (const sale of sales) {
    const date = new Date(sale.createdAt);
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");

    if (!counterMap[dateStr]) {
      counterMap[dateStr] = 1;
    } else {
      counterMap[dateStr]++;
    }

    const sequence = String(counterMap[dateStr]).padStart(3, "0");

    const invoiceNumber = `INV-${dateStr}-${sequence}`;

    sale.invoiceNumber = invoiceNumber;

    await sale.save();

    console.log(`Updated Sale ${sale._id} → ${invoiceNumber}`);
  }

  console.log("Migration complete");

  process.exit();
};

runMigration();