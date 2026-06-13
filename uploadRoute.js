const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const streamifier = require("streamifier");
const db = require("./db");

// 1. Configure Cloudinary
cloudinary.config({
  cloud_name: "dq4usxrkl",
  api_key: "667861286474246",
  api_secret: "u9s1YvN9jCuNkRDiEnmoTC1cpf4",
});

// 2. Configure Multer (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 🛑 A helper function to make Cloudinary uploads async/await friendly!
const uploadToCloudinary = (buffer, resourceType) => {
  return new Promise((resolve, reject) => {
    const options = { resource_type: resourceType };

    const stream = cloudinary.uploader.upload_stream(
      { resource_type: resourceType },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

// 3. Define the Dual-Upload Route
// 🛑 CHANGED: Now accepting an array of fields (video AND thumbnail)
router.post("/finish-upload", upload.any(), async (req, res) => {
  console.log("🚨 UPLOAD SPY - TEXT DATA:", req.body);
  console.log("🚨 UPLOAD SPY - FILES RECEIVED:", req.files); // Let's see exactly what arrived!

  const { title, description, courseId } = req.body;
  const userId = req.user.id;

  // Because we used upload.any(), req.files is now an Array.
  // We need to manually find which file is the video and which is the thumbnail.
  const videoFile = req.files
    ? req.files.find((f) => f.fieldname === "video")
    : null;
  const thumbnailFile = req.files
    ? req.files.find((f) => f.fieldname === "thumbnail")
    : null;

  // Check if the video file exists (video is mandatory)
  if (!videoFile) {
    return res.status(400).json({ message: "No video file uploaded." });
  }

  try {
    // 4. Upload the Video
    console.log("Uploading video to Cloudinary...");
    const videoUrl = await uploadToCloudinary(videoFile.buffer, "video");

    // 5. Upload the Thumbnail (if the user provided one)
    let thumbnailUrl = null;
    if (thumbnailFile) {
      console.log("Uploading thumbnail to Cloudinary...");
      thumbnailUrl = await uploadToCloudinary(thumbnailFile.buffer, "image");
    }

    // 6. Save BOTH URLs to MySQL
    const sql =
      "INSERT INTO videos (title, description, video_url, thumbnail_url, user_id, course_id) VALUES (?, ?, ?, ?, ?, ?)";

    db.query(
      sql,
      [title, description, videoUrl, thumbnailUrl, userId, courseId],
      (err, dbResult) => {
        if (err) {
          console.error("MySQL Error:", err);
          return res.status(500).json({ message: "Error saving to database." });
        }

        console.log("✅ Successfully saved to DB!");
        res.status(201).json({
          message: "Video and Thumbnail uploaded successfully!",
          videoUrl: videoUrl,
          thumbnailUrl: thumbnailUrl,
          id: dbResult.insertId,
        });
      },
    );
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    res.status(500).json({ message: "Error uploading files to Cloudinary." });
  }
});

// Get videos according to course
router.get("/course/:courseId", (req, res) => {
  const courseId = req.params.courseId;
  console.log(
    `\n🕵️ BACKEND SPY: Looking for videos where course_id = ${courseId}`,
  );

  const sql = "SELECT * FROM videos WHERE course_id = ?";
  db.query(sql, [courseId], (err, data) => {
    if (err) return res.status(500).json(err);
    console.log(`✅ FOUND ${data.length} VIDEOS IN DB`);
    return res.json(data);
  });
});

// DELETE VIDEO ROUTE
router.delete("/:id", (req, res) => {
  // Security check: Only allow teachers to delete
  if (req.user.role !== "teacher") {
    return res
      .status(403)
      .json({ message: "Unauthorized. Only teachers can delete videos." });
  }

  const videoId = req.params.id;
  const sql = "DELETE FROM videos WHERE id = ?";

  db.query(sql, [videoId], (err, result) => {
    if (err) {
      console.error("🚨 DATABASE ERROR DURING DELETE:", err);
      return res
        .status(500)
        .json({ message: "Database error while deleting video." });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Video not found." });
    }

    return res.json({ message: "Video successfully deleted!" });
  });
});

//EDIT
router.put("/:id", upload.single("thumbnail"),async(req, res) => {
  
  // Only allow teachers to make updates
  if (!req.user || req.user.role !== "teacher") {
    return res.status(403).json({ message: "Unauthorized. Only teachers can update videos." });
  }

  const videoId = req.params.id;
  const { title, description } = req.body;

  // Validation
  if (!title || title.trim() === "") {
    return res.status(400).json({ message: "Title is required." });
  }

  // CHECK FOR UPLOADED FILE: 
  // If a new file is uploaded, use its path. If not, set it to null.
  let finalThumbnailUrl = null; 
  if (req.file) {
    try {
      finalThumbnailUrl = await uploadToCloudinary(req.file.buffer, "image");
    } catch (cloudinaryError) {
      return res.status(500).json({ message: "Error uploading new thumbnail image to Cloudinary." });
    }
  }

  // 3. THE SAFE SQL QUERY:
  // IFNULL(?, thumbnail_url) means: If finalThumbnailUrl is null, keep the old thumbnail_url exactly as it is!
  const sql = "UPDATE videos SET title = ?, description = ?, thumbnail_url = IFNULL(?, thumbnail_url) WHERE id = ?";
  const values = [title.trim(), description ? description.trim() : "", finalThumbnailUrl, videoId];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("🚨 DATABASE ERROR DURING UPDATE:", err);
      return res.status(500).json({ message: "Database error while updating video." });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Video not found." });
    }

    // Return success response
    return res.json({ 
      message: "Video updated successfully!",
      thumbnail_url: finalThumbnailUrl
     });
  });
});

module.exports = router;
