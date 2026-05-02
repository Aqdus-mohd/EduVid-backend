const mysql = require("mysql2");
require('dotenv').config();

const db = mysql.createPool({
  connectionLimit: 10, 
  // 1. Swap hardcoded values for Environment Variables
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  
  // 2. Aiven Security Requirement: Force an encrypted connection
  ssl: {
      rejectUnauthorized: false
  }
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Error connecting to cloud database:", err);
  }
  if (connection) {
    console.log("✅ Successfully connected to Aiven MySQL database!");
    connection.release();
  }
});

module.exports = db;