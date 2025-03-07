// routes/laeqData.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const { type, limit, startDate, endDate } = req.query;

    let query = "SELECT * FROM laeq_data";
    const params = [];

    // Build query with filters
    const conditions = [];
    if (type) {
      conditions.push("type = ?");
      params.push(type);
    }

    if (startDate) {
      conditions.push("created_at >= ?");
      params.push(new Date(startDate));
    }

    if (endDate) {
      conditions.push("created_at <= ?");
      params.push(new Date(endDate));
    }

    if (conditions.length) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY created_at DESC";

    if (limit) {
      query += " LIMIT ?";
      params.push(parseInt(limit));
    }

    const [rows] = await pool.execute(query, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching LAeq data:", error);
    res.status(500).json({ error: "Failed to fetch LAeq data" });
  }
});

module.exports = router;