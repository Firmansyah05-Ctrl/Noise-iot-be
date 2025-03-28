const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const { limit, status, sort } = req.query;

    // Build the query with potential filters and fixed timezone conversion
    let query =
      "SELECT *, CONVERT_TZ(updated_at, '+00:00', '+08:00') as updated_at FROM mqtt_status";
    const params = [];

    // Create conditions array for multiple WHERE clauses
    const conditions = [];

    // Add status filter if provided
    if (status) {
      conditions.push("status LIKE ?");
      params.push(`${status}%`);
    }

    // Get the most recent timestamp from the database
    const [latestRows] = await pool.execute(
      "SELECT MAX(CONVERT_TZ(updated_at, '+00:00', '+08:00')) as latest_timestamp FROM mqtt_status"
    );

    const latestTimestamp = latestRows[0].latest_timestamp;

    if (latestTimestamp) {
      // Calculate 24 hours before the latest timestamp in the database
      const twentyFourHoursBeforeLatest = new Date(latestTimestamp);
      twentyFourHoursBeforeLatest.setHours(
        twentyFourHoursBeforeLatest.getHours() - 24
      );

      conditions.push("CONVERT_TZ(updated_at, '+00:00', '+08:00') >= ?");
      params.push(twentyFourHoursBeforeLatest);
    }

    // Add WHERE clause if there are conditions
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    // Add sorting if provided
    if (sort) {
      const [sortField, sortDirection] = sort.split(",");
      query += ` ORDER BY ${sortField} ${sortDirection || "DESC"}`;
    } else {
      query += " ORDER BY updated_at DESC";
    }

    // Add limit if provided
    if (limit) {
      query += " LIMIT ?";
      params.push(parseInt(limit));
    }

    const [rows] = await pool.execute(query, params);

    // Format the rows to match exactly what's in the database
    const formattedRows = rows.map((row) => {
      // Create a copy of the original row to avoid modifying the original
      const formattedRow = { ...row };

      // Format created_at to match the format in the database (YYYY-MM-DD HH:MM:SS)
      if (formattedRow.created_at instanceof Date) {
        formattedRow.created_at = formatDate(formattedRow.created_at);
      }

      // Format updated_at to match the format in the database (YYYY-MM-DD HH:MM:SS)
      if (formattedRow.updated_at instanceof Date) {
        formattedRow.updated_at = formatDate(formattedRow.updated_at);
      }

      return formattedRow;
    });

    res.status(200).json(formattedRows);
  } catch (error) {
    console.error("Error fetching MQTT status:", error);
    res.status(500).json({ error: "Failed to fetch MQTT status" });
  }
});

// Helper function to format date to YYYY-MM-DD HH:MM:SS
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

module.exports = router;
