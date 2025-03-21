const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const { limit, startDate, endDate } = req.query;

    // Fixed the query to properly alias the converted timezone field
    let query =
      "SELECT *, CONVERT_TZ(created_at, '+00:00', '+08:00') as created_at FROM laeq_metrics";
    const params = [];

    // Build query with filters
    const conditions = [];

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

    // Map field names and format date
    const mappedRows = rows.map((row) => {
      // Format the date for created_at
      const date = new Date(row.created_at);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");

      // Format created_at as requested and handle null values
      const formattedRow = {
        ...row,
        L10: row.L10 !== null && row.L10 !== undefined ? row.L10 : 0,
        L50: row.L50 !== null && row.L50 !== undefined ? row.L50 : 0,
        L90: row.L90 !== null && row.L90 !== undefined ? row.L90 : 0,
      };

      formattedRow.created_at = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

      return formattedRow;
    });

    res.status(200).json(mappedRows);
  } catch (error) {
    console.error("Error fetching LAeq realtime data:", error);
    res.status(500).json({ error: "Failed to fetch LAeq realtime data" });
  }
});

module.exports = router;
