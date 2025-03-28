const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const { limit, startDate, endDate } = req.query;

    // First, find the most recent timestamp in the database
    const [latestRow] = await pool.execute(
      "SELECT created_at FROM laeq_lmin_lmax ORDER BY created_at DESC LIMIT 1"
    );

    if (!latestRow || latestRow.length === 0) {
      return res.status(200).json([]);
    }

    const latestTimestamp = new Date(latestRow[0].created_at);
    const twentyFourHoursAgo = new Date(latestTimestamp);
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Base query with timezone conversion for created_at (+8 hours)
    let query =
      "SELECT *, CONVERT_TZ(created_at, '+00:00', '+08:00') as created_at FROM laeq_lmin_lmax";
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

    // Format the data
    const formattedRows = rows.map((row) => {
      const date = new Date(row.created_at);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");

      return {
        ...row,
        laeq1h:
          row.laeq1h !== null && row.laeq1h !== undefined ? row.laeq1h : 0,
        Lmax: row.Lmax !== null && row.Lmax !== undefined ? row.Lmax : 0,
        Lmin: row.Lmin !== null && row.Lmin !== undefined ? row.Lmin : 0,
        created_at: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`,
      };
    });

    res.status(200).json(formattedRows);
  } catch (error) {
    console.error("Error fetching LAeq lmin lmax data:", error);
    res.status(500).json({ error: "Failed to fetch LAeq lmin lmax data" });
  }
});

module.exports = router;
