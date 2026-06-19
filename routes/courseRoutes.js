const express = require("express");
const router = express.Router();
const db = require("../db"); // Ensure this path points to your db.js connection file
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const streamifier = require("streamifier");

// 1. Configure Cloudinary (Same credentials as your video upload)
cloudinary.config({
  cloud_name: "dq4usxrkl",
  api_key: "667861286474246",
  api_secret: "u9s1YvN9jCuNkRDiEnmoTC1cpf4",
});

// 2. Setup Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

//helper gunction to make cloudinary upload
const uploadToCloudinary = (buffer, resourceType) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType, folder: "course_thumbnails" },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};


// --- ROUTE 1: GET ALL COURSES ---
router.get("/", (req, res) => {
  const userId = req.user.id;
  if (!userId) return res.status(400).json({ message: "User ID required" });

  const sql =
    "SELECT * FROM courses WHERE user_id = ? ORDER BY created_at DESC";
  db.query(sql, [userId], (err, data) => {
    if (err) return res.status(500).json(err);
    return res.json(data);
  });
});

// --- ROUTE 2: CREATE NEW COURSE (With Image) ---
router.post("/", upload.single("thumbnail"), (req, res) => {
  const { title } = req.body;
  const userId = req.user.id;

  if (!title) return res.status(400).json({ message: "Title is required" });
  if (!req.file)
    return res.status(400).json({ message: "Thumbnail image is required" });

  // A. Upload Image to Cloudinary
  const uploadStream = cloudinary.uploader.upload_stream(
    { folder: "course_thumbnails" },
    (error, result) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ message: "Cloudinary upload failed" });
      }

      // B. Save Title and Image URL to MySQL
      const sql =
        "INSERT INTO courses (`title`, `thumbnail_url`, `user_id`) VALUES (?, ?, ?)";
      db.query(sql, [title, result.secure_url, userId], (err, dbResult) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY")
            return res.status(409).json({ message: "Course already exists!" });
          return res.status(500).json(err);
        }

        // Return the new course data so Frontend can update immediately
        return res.status(201).json({
          id: dbResult.insertId,
          title: title,
          thumbnail_url: result.secure_url,
          user_id: userId,
        });
      });
    },
  );

  streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
});

//fetch all courses
router.get("/all", (req, res) => {
  const sql = "SELECT * FROM courses ORDER BY created_at DESC";
  db.query(sql, (err, data) => {
    if (err) return res.status(500).json(err);
    return res.json(data);
  });
});


// 1. DELETE COURSE ROUTE
router.delete("/:id", (req, res) => {
  if (!req.user || req.user.role !== "teacher") {
    return res.status(403).json({ message: "Unauthorized. Teachers only." });
  }

  const courseId = req.params.id;

  // Note: This will delete the course. Make sure your MySQL table doesn't block it due to foreign keys.
  const sql = "DELETE FROM courses WHERE id = ?";
  db.query(sql, [courseId], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ message: "Database error while deleting course." });
    }
    return res.json({ message: "Course successfully deleted!" });
  });
});

// 2. EDIT / UPDATE COURSE ROUTE
router.put("/:id", upload.single("thumbnail"), async (req, res) => {
  if (!req.user || req.user.role !== "teacher") {
    return res.status(403).json({ message: "Unauthorized." });
  }

  const courseId = req.params.id;
  const { title } = req.body;

  if (!title || title.trim() === "") {
    return res.status(400).json({ message: "Course title cannot be empty." });
  }
  
  let finalThumbnailUrl = null;
  if (req.file) {
    try {
      finalThumbnailUrl = await uploadToCloudinary(req.file.buffer, "image");
    } catch (err) {
      return res.status(500).json({ message: "Cloudinary upload failed." });
    }
  }

  const sql = "UPDATE courses SET title = ?, thumbnail_url = IFNULL(?, thumbnail_url) WHERE id = ?";
  db.query(sql, [title.trim(), finalThumbnailUrl, courseId], (err, result) => {
    if (err) return res.status(500).json({ message: "Database update error." });
    return res.json({ message: "Course updated successfully!", thumbnail_url: finalThumbnailUrl });
  });
});

module.exports = router;
