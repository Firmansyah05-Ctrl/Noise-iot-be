// routes/mqttStatus.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const { limit } = req.query;

    // Select all columns from mqtt_status
    let query = "SELECT * FROM mqtt_status ORDER BY updated_at DESC";
    const params = [];

    if (limit) {
      query += " LIMIT ?";
      params.push(parseInt(limit));
    }

    const [rows] = await pool.execute(query, params);

    // Format the rows to match exactly what's in the database
    const formattedRows = rows.map(row => {
      // Create a copy of the original row to avoid modifying the original
      const formattedRow = {...row};

      // Format updated_at to match the format in the database (YYYY-MM-DD HH:MM:SS)
      if (row.updated_at instanceof Date) {
        const year = row.updated_at.getFullYear();
        const month = String(row.updated_at.getMonth() + 1).padStart(2, '0');
        const day = String(row.updated_at.getDate()).padStart(2, '0');
        const hours = String(row.updated_at.getHours()).padStart(2, '0');
        const minutes = String(row.updated_at.getMinutes()).padStart(2, '0');
        const seconds = String(row.updated_at.getSeconds()).padStart(2, '0');

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