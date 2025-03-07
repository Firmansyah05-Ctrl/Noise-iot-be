// routes/mqttStatus.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  try {
    const { limit } = req.query;

    let query = "SELECT * FROM mqtt_status ORDER BY updated_at DESC";
    const params = [];

    if (limit) {
      query += " LIMIT ?";
      params.push(parseInt(limit));
    }

    const [rows] = await pool.execute(query, params);
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching MQTT status:", error);
    res.status(500).json({ error: "Failed to fetch MQTT status" });
  }
});

module.exports = router;
