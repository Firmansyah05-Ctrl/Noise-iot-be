// routes/tblLaeq.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const { limit, startDate, endDate } = req.query;

    let query = "SELECT * FROM tbl_laeq";
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

    // tbl_laeq only has laeq field based on your schema
    const validatedRows = rows.map((row) => ({
      ...row,
      laeq: row.laeq !== null && row.laeq !== undefined ? row.laeq : 0
    }));

    res.status(200).json(validatedRows);
  } catch (error) {
    console.error("Error fetching LAeq table data:", error);
    res.status(500).json({ error: "Failed to fetch LAeq table data" });
  }
});

module.exports = router;