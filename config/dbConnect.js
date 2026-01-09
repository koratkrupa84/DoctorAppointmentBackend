// config/dbConnect.js
const mongoose = require("mongoose");

function dbConnect() {
  mongoose.connect("mongodb+srv://Krupa:08032006@cluster0.vsou0cr.mongodb.net/doctorApp")
    .then(() => console.log("✅ MongoDB connected successfully"))
    .catch((err) => {
      console.error("❌ MongoDB connection error:", err);
    });
}

module.exports = dbConnect;