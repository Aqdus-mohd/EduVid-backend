const mysql = require("mysql2");
require('dotenv').config();

const db = mysql.createPool({
  connectionLimit: 10, 
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 4000, // Default TiDB port fallback
  
  // Enforce secure SSL connection required by TiDB Cloud
  ssl: {
    rejectUnauthorized: true
  }
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Error connecting to cloud database:", err);
  }
  if (connection) {
    console.log("✅ Successfully connected to TiDB MySQL database!");
    connection.release();
  }
});

module.exports = db;