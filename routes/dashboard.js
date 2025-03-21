const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  try {
    // Run all queries in parallel using Promise.all for better performance
    // Added timezone conversion to all SQL queries
    const [
      latestLaeqResult,
      mqttStatusResult,
      latestHourlyResult,
      latestRealtimeResult,
      latestHourlyResultnew,
      todayStatsResult,
    ] = await Promise.all([
      pool.execute(
        "SELECT *, CONVERT_TZ(created_at, '+00:00', '+08:00') as created_at FROM laeq ORDER BY created_at DESC LIMIT 1"
      ),
      pool.execute(
        "SELECT *, CONVERT_TZ(updated_at, '+00:00', '+08:00') as updated_at FROM mqtt_status ORDER BY updated_at DESC LIMIT 1"
      ),
      pool.execute(
        "SELECT *, CONVERT_TZ(created_at, '+00:00', '+08:00') as created_at FROM laeq_lmin_lmax ORDER BY created_at DESC LIMIT 1"
      ),
      pool.execute(
        "SELECT *, CONVERT_TZ(created_at, '+00:00', '+08:00') as created_at FROM laeq_metrics ORDER BY created_at DESC LIMIT 1"
      ),
      pool.execute(
        "SELECT *, CONVERT_TZ(created_at, '+00:00', '+08:00') as created_at FROM laeq_hourly ORDER BY created_at DESC LIMIT 1"
      ),
      pool.execute(
        "SELECT MAX(laeq) as maxLaeq, MIN(laeq) as minLaeq, AVG(laeq) as avgLaeq FROM laeq WHERE created_at >= ?",
        [new Date().setHours(0, 0, 0, 0)]
      ),
    ]);

    // Format dates for each result if needed
    const formatDate = (dateObj) => {
      if (!dateObj) return null;

      const date = new Date(dateObj);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      const seconds = String(date.getSeconds()).padStart(2, "0");

      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    // Get L10, L50, L90 values from laeq_realtime
    let L10 = 0,
      L50 = 0,
      L90 = 0;
    if (latestRealtimeResult[0][0]) {
      L10 =
        latestRealtimeResult[0][0].L10 !== null &&
        latestRealtimeResult[0][0].L10 !== undefined
          ? latestRealtimeResult[0][0].L10
          : 0;
      L50 =
        latestRealtimeResult[0][0].L50 !== null &&
        latestRealtimeResult[0][0].L50 !== undefined
          ? latestRealtimeResult[0][0].L50
          : 0;
      L90 =
        latestRealtimeResult[0][0].L90 !== null &&
        latestRealtimeResult[0][0].L90 !== undefined
          ? latestRealtimeResult[0][0].L90
          : 0;
    }

    // Get Lmax and Lmin from laeq_lmin_lmax
    let Lmax = 0,
      Lmin = 0;
    if (latestHourlyResult[0][0]) {
      Lmax =
        latestHourlyResult[0][0].Lmax !== null &&
        latestHourlyResult[0][0].Lmax !== undefined
          ? latestHourlyResult[0][0].Lmax
          : 0;
      Lmin =
        latestHourlyResult[0][0].Lmin !== null &&
        latestHourlyResult[0][0].Lmin !== undefined
          ? latestHourlyResult[0][0].Lmin
          : 0;
    }

    // Get laeq1h from laeq_hourly
    let laeq1h = 0;
    if (latestHourlyResultnew[0][0]) {
      laeq1h =
        latestHourlyResultnew[0][0].laeq1h !== null &&
        latestHourlyResultnew[0][0].laeq1h !== undefined
          ? latestHourlyResultnew[0][0].laeq1h
          : 0;
    }

    // Format the created_at and updated_at fields in the results
    if (latestLaeqResult[0][0] && latestLaeqResult[0][0].created_at) {
      latestLaeqResult[0][0].created_at = formatDate(
        latestLaeqResult[0][0].created_at
      );
    }

    if (mqttStatusResult[0][0] && mqttStatusResult[0][0].updated_at) {
      mqttStatusResult[0][0].updated_at = formatDate(
        mqttStatusResult[0][0].updated_at
      );
    }

    if (latestHourlyResult[0][0] && latestHourlyResult[0][0].created_at) {
      latestHourlyResult[0][0].created_at = formatDate(
        latestHourlyResult[0][0].created_at
      );
    }

    if (latestRealtimeResult[0][0] && latestRealtimeResult[0][0].created_at) {
      latestRealtimeResult[0][0].created_at = formatDate(
        latestRealtimeResult[0][0].created_at
      );
    }

    if (latestHourlyResultnew[0][0] && latestHourlyResultnew[0][0].created_at) {
      latestHourlyResultnew[0][0].created_at = formatDate(
        latestHourlyResultnew[0][0].created_at
      );
    }

    // Construct response with fallbacks for null values and correctly named fields
    const responseData = {
      latestLaeq: latestLaeqResult[0][0]
        ? {
            ...latestLaeqResult[0][0],
            L10,
            L50,
            L90, // Use capital L to match your database schema
            Lmax,
            Lmin,
          }
        : null,
      mqttStatus: mqttStatusResult[0][0] || { status: "Offline" }, // Capitalize first letter to match enum
      latestHourly: latestHourlyResult[0][0]
        ? {
            ...latestHourlyResult[0][0],
            Lmax:
              latestHourlyResult[0][0].Lmax !== null &&
              latestHourlyResult[0][0].Lmax !== undefined
                ? latestHourlyResult[0][0].Lmax
                : 0,
            Lmin:
              latestHourlyResult[0][0].Lmin !== null &&
              latestHourlyResult[0][0].Lmin !== undefined
                ? latestHourlyResult[0][0].Lmin
                : 0,
          }
        : null,
      latestHourlyNew: latestHourlyResultnew[0][0]
        ? {
            ...latestHourlyResultnew[0][0],
            laeq1h:
              latestHourlyResultnew[0][0].laeq1h !== null &&
              latestHourlyResultnew[0][0].laeq1h !== undefined
                ? latestHourlyResultnew[0][0].laeq1h
                : 0,
          }
        : null,
      latestRealtime: latestRealtimeResult[0][0]
        ? {
            ...latestRealtimeResult[0][0],
            L10:
              latestRealtimeResult[0][0].L10 !== null &&
              latestRealtimeResult[0][0].L10 !== undefined
                ? latestRealtimeResult[0][0].L10
                : 0,
            L50:
              latestRealtimeResult[0][0].L50 !== null &&
              latestRealtimeResult[0][0].L50 !== undefined
                ? latestRealtimeResult[0][0].L50
                : 0,
            L90:
              latestRealtimeResult[0][0].L90 !== null &&
              latestRealtimeResult[0][0].L90 !== undefined
                ? latestRealtimeResult[0][0].L90
                : 0,
          }
        : null,
      todayStats: todayStatsResult[0][0] || {
        maxLaeq: 0,
        minLaeq: 0,
        avgLaeq: 0,
      },
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});

module.exports = router;
