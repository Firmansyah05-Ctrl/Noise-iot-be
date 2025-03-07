// routes/dashboard.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  try {
    // Run all queries in parallel using Promise.all for better performance
    const [latestLaeqResult, mqttStatusResult, latestHourlyResult, 
           latestRealtimeResult, todayStatsResult] = await Promise.all([
      pool.execute("SELECT * FROM tbl_laeq ORDER BY created_at DESC LIMIT 1"),
      pool.execute("SELECT * FROM mqtt_status ORDER BY updated_at DESC LIMIT 1"),
      pool.execute("SELECT * FROM laeq_hourly ORDER BY created_at DESC LIMIT 1"),
      pool.execute("SELECT * FROM laeq_realtime ORDER BY created_at DESC LIMIT 1"),
      pool.execute("SELECT MAX(laeq) as maxLaeq, MIN(laeq) as minLaeq, AVG(laeq) as avgLaeq FROM tbl_laeq WHERE created_at >= ?", 
        [new Date().setHours(0, 0, 0, 0)])
    ]);

    // Get L10, L50, L90 values from laeq_realtime
    let L10 = 0, L50 = 0, L90 = 0;
    if (latestRealtimeResult[0][0]) {
      L10 = latestRealtimeResult[0][0].L10 || 0;
      L50 = latestRealtimeResult[0][0].L50 || 0;
      L90 = latestRealtimeResult[0][0].L90 || 0;
    }

    // Get Lmax and Lmin from laeq_hourly
    let Lmax = 0, Lmin = 0;
    if (latestHourlyResult[0][0]) {
      Lmax = latestHourlyResult[0][0].Lmax || 0;
      Lmin = latestHourlyResult[0][0].Lmin || 0;
    }

    // Construct response with fallbacks for null values and correctly named fields
    const responseData = {
      latestLaeq: latestLaeqResult[0][0] ? {
        ...latestLaeqResult[0][0],
        L10, L50, L90, // Use capital L to match your database schema
        Lmax, Lmin
      } : null,
      mqttStatus: mqttStatusResult[0][0] || { status: "Offline" }, // Capitalize first letter to match enum
      latestHourly: latestHourlyResult[0][0] ? {
        ...latestHourlyResult[0][0],
        laeq1h: latestHourlyResult[0][0].laeq1h || 0,
        Lmax: latestHourlyResult[0][0].Lmax || 0,
        Lmin: latestHourlyResult[0][0].Lmin || 0
      } : null,
      latestRealtime: latestRealtimeResult[0][0] ? {
        ...latestRealtimeResult[0][0],
        L10: latestRealtimeResult[0][0].L10 || 0,
        L50: latestRealtimeResult[0][0].L50 || 0,
        L90: latestRealtimeResult[0][0].L90 || 0
      } : null,
      todayStats: todayStatsResult[0][0] || { maxLaeq: 0, minLaeq: 0, avgLaeq: 0 }
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

module.exports = router;