const express = require("express");
const router = express.Router();
const pool = require("../config/db");

router.get("/", async (req, res) => {
  const { reportType } = req.query;

  try {
    let query;
    const timeCondition = "WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)";

    switch (reportType) {
      case "laeq":
        query = `
          SELECT id, value as laeq, created_at, CONVERT_TZ(created_at, '+00:00', '+08:00') as local_time 
          FROM laeq 
          ${timeCondition}
          ORDER BY created_at DESC`;
        break;
      case "percentiles":
        query = `
          SELECT id, L10, L50, L90, created_at, CONVERT_TZ(created_at, '+00:00', '+08:00') as local_time 
          FROM laeq_metrics 
          ${timeCondition}
          ORDER BY created_at DESC`;
        break;
      case "extremes":
        query = `
          SELECT id, Lmin, Lmax, created_at, CONVERT_TZ(created_at, '+00:00', '+08:00') as local_time 
          FROM laeq_lmin_lmax 
          ${timeCondition}
          ORDER BY created_at DESC`;
        break;
      case "all":
      default:
        query = `
          SELECT id, value as laeq, NULL as L10, NULL as L50, NULL as L90, NULL as Lmin, NULL as Lmax, 
                created_at as db_time, CONVERT_TZ(created_at, '+00:00', '+08:00') as local_time 
          FROM laeq
          ${timeCondition}
          UNION ALL
          SELECT id, NULL as laeq, L10, L50, L90, NULL as Lmin, NULL as Lmax, 
                created_at as db_time, CONVERT_TZ(created_at, '+00:00', '+08:00') as local_time 
          FROM laeq_metrics
          ${timeCondition}
          UNION ALL
          SELECT id, NULL as laeq, NULL as L10, NULL as L50, NULL as L90, Lmin, Lmax, 
                created_at as db_time, CONVERT_TZ(created_at, '+00:00', '+08:00') as local_time 
          FROM laeq_lmin_lmax
          ${timeCondition}
          ORDER BY db_time DESC
        `;
        break;
    }

    const [results] = await pool.execute(query);

    // Solusi yang lebih baik: Pertama ambil data terbaru untuk setiap parameter dari seluruh dataset
    let lastValues = {
      laeq: null,
      L10: null,
      L50: null,
      L90: null,
      Lmin: null,
      Lmax: null,
    };

    // Pertama temukan nilai terbaru untuk masing-masing parameter dari keseluruhan dataset
    results.forEach((row) => {
      if (row.laeq !== null && lastValues.laeq === null)
        lastValues.laeq = row.laeq;
      if (row.L10 !== null && lastValues.L10 === null) lastValues.L10 = row.L10;
      if (row.L50 !== null && lastValues.L50 === null) lastValues.L50 = row.L50;
      if (row.L90 !== null && lastValues.L90 === null) lastValues.L90 = row.L90;
      if (row.Lmin !== null && lastValues.Lmin === null)
        lastValues.Lmin = row.Lmin;
      if (row.Lmax !== null && lastValues.Lmax === null)
        lastValues.Lmax = row.Lmax;
    });

    // Sekarang format hasil dengan mengisi nilai yang kosong
    const formattedResults = results.map((row) => {
      const timeToFormat = row.local_time || row.created_at;

      // Update nilai terbaru untuk saat ini dan seterusnya
      if (row.laeq !== null) lastValues.laeq = row.laeq;
      if (row.L10 !== null) lastValues.L10 = row.L10;
      if (row.L50 !== null) lastValues.L50 = row.L50;
      if (row.L90 !== null) lastValues.L90 = row.L90;
      if (row.Lmin !== null) lastValues.Lmin = row.Lmin;
      if (row.Lmax !== null) lastValues.Lmax = row.Lmax;

      // Hasil dengan nilai terbaru yang terisi
      return {
        id: row.id,
        laeq: row.laeq !== null ? row.laeq : lastValues.laeq,
        L10: row.L10 !== null ? row.L10 : lastValues.L10,
        L50: row.L50 !== null ? row.L50 : lastValues.L50,
        L90: row.L90 !== null ? row.L90 : lastValues.L90,
        Lmin: row.Lmin !== null ? row.Lmin : lastValues.Lmin,
        Lmax: row.Lmax !== null ? row.Lmax : lastValues.Lmax,
        created_at: new Date(timeToFormat).toLocaleString("id-ID", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      };
    });

    res.status(200).json(formattedResults);
  } catch (error) {
    console.error("Error exporting data:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
});

module.exports = router;
