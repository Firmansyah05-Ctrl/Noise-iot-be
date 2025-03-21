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
      params.push(`${status}%`); // Use LIKE to match 'Online' in 'Online2025-03-03 11:51:53'
    }

    // Add 24-hour filter by default
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    conditions.push("updated_at >= ?");
    params.push(twentyFourHoursAgo);

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
        const year = formattedRow.created_at.getFullYear();
        const month = String(formattedRow.created_at.getMonth() + 1).padStart(
          2,
          "0"
        );
        const day = String(formattedRow.created_at.getDate()).padStart(2, "0");
        const hours = String(formattedRow.created_at.getHours()).padStart(
          2,
          "0"
        );
        const minutes = String(formattedRow.created_at.getMinutes()).padStart(
          2,
          "0"
        );
        const seconds = String(formattedRow.created_at.getSeconds()).padStart(
          2,
          "0"
        );

        formattedRow.created_at = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      }

      // Format updated_at to match the format in the database (YYYY-MM-DD HH:MM:SS)
      if (formattedRow.updated_at instanceof Date) {
        const year = formattedRow.updated_at.getFullYear();
        const month = String(formattedRow.updated_at.getMonth() + 1).padStart(
          2,
          "0"
        );
        const day = String(formattedRow.updated_at.getDate()).padStart(2, "0");
        const hours = String(formattedRow.updated_at.getHours()).padStart(
          2,
          "0"
        );
        const minutes = String(formattedRow.updated_at.getMinutes()).padStart(
          2,
          "0"
        );
        const seconds = String(formattedRow.updated_at.getSeconds()).padStart(
          2,
          "0"
        );

        formattedRow.updated_at = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      }

      return formattedRow;
    });

    res.status(200).json(formattedRows);
  } catch (error) {
    console.error("Error fetching MQTT status:", error);
    res.status(500).json({ error: "Failed to fetch MQTT status" });
  }
});

module.exports = router;
