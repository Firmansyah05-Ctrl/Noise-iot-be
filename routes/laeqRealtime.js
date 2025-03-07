// routes/laeqRealtime.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const { limit, startDate, endDate } = req.query;

    let query = "SELECT * FROM laeq_realtime";
    const params = [];

    // Build query with filters
    const conditions = [];

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
    
    // Map field names to match table structure (capital L for L10, L50, L90)
    const mappedRows = rows.map(row => ({
      ...row,
      L10: row.L10 || 0,
      L50: row.L50 || 0,
      L90: row.L90 || 0
    }));
    
    res.status(200).json(mappedRows);
  } catch (error) {
    console.error("Error fetching LAeq realtime data:", error);
    res.status(500).json({ error: "Failed to fetch LAeq realtime data" });
  }
});

module.exports = router;