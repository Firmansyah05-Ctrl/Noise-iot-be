const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const { type, limit, startDate, endDate } = req.query;

    // Fixed query with proper alias for the converted timestamp
    let query =
      "SELECT *, CONVERT_TZ(created_at, '+00:00', '+08:00') as created_at FROM laeq_data";
    const params = [];

    // Build query with filters
    const conditions = [];
    if (type) {
      conditions.push("type = ?");
      params.push(type);
    }

    // Add default 24-hour filter if no startDate is provided
    if (startDate) {
      conditions.push("created_at >= ?");
      params.push(new Date(startDate));
    } else {
      // Filter for the last 24 hours
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      conditions.push("created_at >= ?");
      params.push(twentyFourHoursAgo);
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

    // Format the created_at timestamp for each row
    const formattedRows = rows.map((row) => {
      const formattedRow = { ...row };
      if (formattedRow.created_at) {
        const date = new Date(formattedRow.created_at);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");

        formattedRow.created_at = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      }
      return formattedRow;
    });

    res.status(200).json(formattedRows);
  } catch (error) {
    console.error("Error fetching LAeq data:", error);
    res.status(500).json({ error: "Failed to fetch LAeq data" });
  }
});

module.exports = router;
