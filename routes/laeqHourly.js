const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const { limit, startDate, endDate } = req.query;

    // First, find the most recent timestamp in the database for 1h data
    const [latestRow] = await pool.execute(
      "SELECT created_at FROM laeq_data WHERE type = '1h' ORDER BY created_at DESC LIMIT 1"
    );

    if (!latestRow || latestRow.length === 0) {
      return res.status(200).json([]);
    }

    const latestTimestamp = new Date(latestRow[0].created_at);
    const twentyFourHoursAgo = new Date(latestTimestamp);
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Base query with columns specified
    let query =
      "SELECT value as laeq, type, CONVERT_TZ(created_at, '+00:00', '+08:00') as created_at FROM laeq_data";
    const params = [];

    // Build query with filters - start with the required type filter
    const conditions = ["type = '1h'"];

    // Use custom date range if provided, otherwise use last 24 hours from latest data
    if (startDate) {
      conditions.push("created_at >= ?");
      params.push(new Date(startDate));
    } else {
      conditions.push("created_at >= ?");
      params.push(twentyFourHoursAgo);
    }

    if (endDate) {
      conditions.push("created_at <= ?");
      params.push(new Date(endDate));
    } else {
      conditions.push("created_at <= ?");
      params.push(latestTimestamp);
    }

    // Add WHERE clause with all conditions
    query += " WHERE " + conditions.join(" AND ");

    // Add ordering
    query += " ORDER BY created_at DESC";

    // Set default limit to 24 for hourly data if not specified
    const finalLimit = limit ? parseInt(limit) : 24;
    query += " LIMIT ?";
    params.push(finalLimit);

    const [rows] = await pool.execute(query, params);

    // Format the created_at timestamp for each row
    const formattedRows = rows.map((row) => {
      const formattedRow = { ...row };
      if (formattedRow.created_at) {
        const date = new Date(formattedRow.created_at);
        formattedRow.created_at = date
          .toISOString()
          .replace("T", " ")
          .replace(/\.\d+Z$/, "");
      }
      return formattedRow;
    });

    res.status(200).json(formattedRows);
  } catch (error) {
    console.error("Error fetching LAeq hourly data:", error);
    res.status(500).json({
      error: "Failed to fetch LAeq hourly data",
      details: error.message,
    });
  }
});

module.exports = router;
