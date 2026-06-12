const express = require("express");
const mysql = require("mysql2");
require("dotenv").config();
const cors = require("cors");
const bcrypt = require("bcrypt"); //To encrypt the password
const jwt = require("jsonwebtoken"); //To replace local storage
const JWT_SECRET = "my_super_secret_key_12345";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const db = require("./db");
const uploadRoutes = require("./uploadRoute");
const courseRoutes = require("./routes/courseRoutes");

// 🛑 THE MIDDLEWARE BOUNCER 🛑
const verifyToken = (req, res, next) => {
  // 1. Check if there is an Authorization header
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    // No token? Its a Hacker deny access.
    return res
      .status(401)
      .json({ message: "Access Denied. No token provided." });
  }

  // 2. They have a token! check if it's real.
  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      // Fake or expired token? Its hacker deny access.
      return res.status(403).json({ message: "Invalid or expired token." });
    }

    // 3. The token is real!
    // We take their ID/Role from the token and tape it to the 'req' object
    // so the next route knows exactly who is making the request!
    req.user = decodedUser;

    // 4. pass the request to their desired request handlers
    next();
  });
};


app.use("/api/upload", verifyToken, uploadRoutes);
app.use("/api/courses", verifyToken, courseRoutes);

app.get("/", (req, res) => {
  res.send("🚀 Backend is working!");
});

app.post("/Register", async (req, res) => {
  // 👈 Make this async
  console.log("📥 Received registering data:", req.body);

  // SECURITY CHECK: Only allow 'teacher' if they know the code
  if (req.body.role === "teacher") {
    if (req.body.passKey !== process.env.TEACHER_SECRET) {
      return res.json({ message: "Invalid Pass Key! Registration failed." });
    }
  }

  try {
    //SCRAMBLE THE PASSWORD
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(req.body.pass, saltRounds);

    const sql =
      "INSERT INTO users (`username`,`email`,`password`,`role`) VALUES(?)";
    const values = [
      req.body.username,
      req.body.email,
      hashedPassword, //SAVE THE SCRAMBLED PASSWORD INSTEAD OF req.body.pass(plain text)
      req.body.role,
    ];

    db.query(sql, [values], (err, data) => {
      if (err) {
        // Print the real error to the Render terminal so we can see it!
        console.error("🚨 DATABASE ERROR:", err); 

        //If email is UNIQUE in your DB, this catches duplicates!
        if (err.code === "ER_DUP_ENTRY") {
          return res.json({ message: "Email already exists! Please Log In." });
        }
        return res.json("Error");
      }
      return res.json({ message: "successfully registered" });
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json("Server Error");
  }
});

app.post("/Login", (req, res) => {
  console.log("📥 Received login data:", req.body);

  // 👇 FIX: Removed "AND pass = ?" from the query!
  const sql = "SELECT * FROM users WHERE email = ?";
  const values = [req.body.email];

  db.query(sql, values, async (err, data) => {
    if (err) {
      console.error("SQL Error users:", err); // Pro-tip: This helps see the exact error in your terminal
      return res.json(" Mysql Error");
    }

    if (data.length > 0) {
      const isMatch = await bcrypt.compare(req.body.pass, data[0].password);

      if (isMatch) {
        const payload = {
          id: data[0].id,
          username: data[0].username,
          email: data[0].email,
          role: data[0].role,
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });

        return res.json({
          message: "Login successful",
          token: token,
          user: payload,
        });
      } else {
        // Passwords did not match!
        return res.json({ message: "Invalid Password" });
      }
    } else {
      // Email wasn't found
      return res.json({ message: "Email or Login does not exists" });
    }
  });
});

//Verify the token is real or not(identifying hacker)
app.get("/verify", (req, res) => {
  // 1. Extract the token. It usually comes attached to a header called "Authorization"
  // formatted like "Bearer jtw_token_string_here"
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  // 2. The Verification Math
  // It takes the token from the user, and mixes it with your secret key.
  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      // If the math fails (hacker changed a letter, or 24 hours passed),
      // 'err' gets triggered and we send a 403 (Forbidden) error.
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    // If the math perfectly recreates the signature, it means the token
    // is 100% authentic and hasn't expired. We send back a thumbs up.
    return res.json({ message: "Token is valid" });
  });
});



app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
