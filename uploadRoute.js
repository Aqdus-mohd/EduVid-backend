console.log("✅✅✅ LOADED THE CORRECT UPLOAD FILE ✅✅✅");
const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const streamifier = require("streamifier");
const db = require("./db");

// 1. Configure Cloudinary
// (Store these securely in a .env file, not in your code!)
cloudinary.config({
  cloud_name: "dq4usxrkl",
  api_key: "667861286474246",
  api_secret: "u9s1YvN9jCuNkRDiEnmoTC1cpf4",
});

// 2. Configure Multer
// This tells Multer to store the file in memory as a Buffer.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 3. Define the Upload Route
router.post("/finish-upload", upload.single("video"), (req, res) => {
  console.log("🚨 UPLOAD SPY - TEXT DATA:", req.body);

  // Get other form data (e.g., title)
  const { title, description, courseId } = req.body;
  const userId = req.user.id;//sequre id
  if (!req.file) {
    return res.status(400).json({ message: "No video file uploaded." });
  }

  // 4. Create the upload stream to Cloudinary
  // 'resource_type: "video"' is important!
  const uploadStream = cloudinary.uploader.upload_stream(
    { resource_type: "video" },
    (error, result) => {
      if (error) {
        console.error("Cloudinary Error:", error);
        return res
          .status(500)
          .json({ message: "Error uploading to Cloudinary." });
      }

      // 5. We have the Cloudinary URL (result.secure_url)
      // Now, save the URL and title to MySQL
      const videoUrl = result.secure_url;
      const sql =
        "INSERT INTO videos (title, description, video_url, user_id, course_id) VALUES (?, ?, ?, ?, ?)";

      db.query(
        sql,
        [title, description, videoUrl, userId, courseId],
        (err, dbResult) => {
          if (err) {
            console.error("MySQL Error:", err);
            return res
              .status(500)
              .json({ message: "Error saving to database." });
          }

          // 6. Send success response back to React
          res.status(201).json({
            message: "Video uploaded successfully!",
            url: videoUrl,
            id: dbResult.insertId,
          });
        },
      );
    },
  );

  // 7. Pipe the file buffer from Multer into the Cloudinary stream
  streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
});

//get videos according to course

router.get("/course/:courseId", (req, res) => {
  const courseId = req.params.courseId;
  console.log(
    `\n🕵️ BACKEND SPY: Looking for videos where course_id = ${courseId}`,
  );
  const sql = "SELECT * FROM videos WHERE course_id = ?";

  db.query(sql, [courseId], (err, data) => {
    if (err) return res.status(500).json(err);

    console.log(`✅ FOUND ${data.length} VIDEOS IN DB:`, data);

    return res.json(data);
  });
});

module.exports = router;
