const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const { limit, startDate, endDate } = req.query;

    // Base query with columns specified
    let query =
      "SELECT value as laeq, type, CONVERT_TZ(created_at, '+00:00', '+08:00') as created_at FROM laeq_data";
    const params = [];

    // Build query with filters - start with the required type filter
    const conditions = ["type = '1m'"];

    // Add date range filters if provided
    if (startDate) {
      conditions.push("created_at >= ?");
      params.push(new Date(startDate));
    } else if (!limit) {
      // Filter for the last 24 hours if no limit and no startDate specified
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      conditions.push("created_at >= ?");
      params.push(twentyFourHoursAgo);
    }

    if (endDate) {
      conditions.push("created_at <= ?");
      params.push(new Date(endDate));
    }

    // Add WHERE clause with all conditions
    query += " WHERE " + conditions.join(" AND ");

    // Add ordering
    query += " ORDER BY created_at DESC";

    // Set default limit to 60 for minute data
    const finalLimit = limit ? parseInt(limit) : 60;
    query += " LIMIT ?";
    params.push(finalLimit);

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
