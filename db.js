const mysql = require("mysql");

const db = mysql.createPool({
  connectionLimit: 10, 
  host: "localhost",
  user: "root",
  password: "",
  database: "practice"
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Error connecting to database:", err);
  }
  if (connection) {
    console.log("✅ Successfully connected to MySQL database!");
    connection.release();
  }
});

module.exports = db;