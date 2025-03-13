// routes/laeqHourly.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const { limit, startDate, endDate } = req.query;

    let query = "SELECT * FROM laeq_hourly";
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
    
    // Map field names to match table structure and format created_at
    const mappedRows = rows.map(row => {
      const date = new Date(row.created_at);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      const formattedRow = {
        ...row,
        laeq1h: row.laeq1h || 0,
        Lmax: row.Lmax || 0,
        Lmin: row.Lmin || 0
      };
      
      formattedRow.created_at = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      
      return formattedRow;
    });
    
    res.status(200).json(mappedRows);
  } catch (error) {
    console.error("Error fetching LAeq hourly data:", error);
    res.status(500).json({ error: "Failed to fetch LAeq hourly data" });
  }
});

module.exports = router;