const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const { limit, startDate, endDate } = req.query;

    // First, find the most recent timestamp in the database
    const [latestRow] = await pool.execute(
      "SELECT created_at FROM laeq_metrics ORDER BY created_at DESC LIMIT 1"
    );

    if (!latestRow || latestRow.length === 0) {
      return res.status(200).json([]);
    }

    const latestTimestamp = new Date(latestRow[0].created_at);
    const twentyFourHoursAgo = new Date(latestTimestamp);
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Base query with timezone conversion for created_at (+8 hours)
    let query =
      "SELECT *, CONVERT_TZ(created_at, '+00:00', '+08:00') as created_at FROM laeq_metrics";
    const params = [];
    const conditions = [];

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

    if (conditions.length) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY created_at DESC";

    if (limit) {
      query += " LIMIT ?";
      params.push(parseInt(limit));
    }

    const [rows] = await pool.execute(query, params);

    // Format the response data
    const formattedRows = rows.map((row) => {
      const date = new Date(row.created_at);
      const formattedDate = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(
        date.getHours()
      ).padStart(2, "0")}:${String(date.getMinutes()).padStart(
        2,
        "0"
      )}:${String(date.getSeconds()).padStart(2, "0")}`;

      return {
        ...row,
        L10: row.L10 ?? 0, // Using nullish coalescing operator
        L50: row.L50 ?? 0,
        L90: row.L90 ?? 0,
        created_at: formattedDate,
      };
    });

    res.status(200).json(formattedRows);
  } catch (error) {
    console.error("Error fetching LAeq metrics data:", error);
    res.status(500).json({
      error: "Failed to fetch LAeq metrics data",
      details: error.message,
    });
  }
});

module.exports = router;
