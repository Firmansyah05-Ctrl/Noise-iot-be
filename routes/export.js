const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");

// API endpoint for viewing data
router.get("/", async (req, res) => {
  const { reportType, days = 1 } = req.query;

  try {
    // Parse days parameter with fallback to 1
    const daysNum = parseInt(days, 10) || 1;
    const timeCondition = `WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${daysNum} DAY)`;

    // Build query based on report type
    let query;
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

    if (results.length === 0) {
      return res
        .status(404)
        .json({ error: "No data found for the given parameters" });
    }

    let formattedResults;

    // For the "all" report type, use special logic to fill in missing values
    if (reportType === "all") {
      // Track the latest values for each parameter
      let lastValues = {
        laeq: null,
        L10: null,
        L50: null,
        L90: null,
        Lmin: null,
        Lmax: null,
      };

      // First find the most recent value for each parameter
      results.forEach((row) => {
        if (row.laeq !== null && lastValues.laeq === null)
          lastValues.laeq = row.laeq;
        if (row.L10 !== null && lastValues.L10 === null)
          lastValues.L10 = row.L10;
        if (row.L50 !== null && lastValues.L50 === null)
          lastValues.L50 = row.L50;
        if (row.L90 !== null && lastValues.L90 === null)
          lastValues.L90 = row.L90;
        if (row.Lmin !== null && lastValues.Lmin === null)
          lastValues.Lmin = row.Lmin;
        if (row.Lmax !== null && lastValues.Lmax === null)
          lastValues.Lmax = row.Lmax;
      });

      // Format results with latest values filling in missing data
      formattedResults = results.map((row) => {
        const timeToFormat = row.local_time || row.created_at || row.db_time;

        // Update the latest known values as we process rows
        if (row.laeq !== null) lastValues.laeq = row.laeq;
        if (row.L10 !== null) lastValues.L10 = row.L10;
        if (row.L50 !== null) lastValues.L50 = row.L50;
        if (row.L90 !== null) lastValues.L90 = row.L90;
        if (row.Lmin !== null) lastValues.Lmin = row.Lmin;
        if (row.Lmax !== null) lastValues.Lmax = row.Lmax;

        // Return row with all values filled in from latest available
        return {
          id: row.id,
          laeq:
            row.laeq !== null
              ? formatDecimal(row.laeq)
              : formatDecimal(lastValues.laeq),
          L10:
            row.L10 !== null
              ? formatDecimal(row.L10)
              : formatDecimal(lastValues.L10),
          L50:
            row.L50 !== null
              ? formatDecimal(row.L50)
              : formatDecimal(lastValues.L50),
          L90:
            row.L90 !== null
              ? formatDecimal(row.L90)
              : formatDecimal(lastValues.L90),
          Lmin:
            row.Lmin !== null
              ? formatDecimal(row.Lmin)
              : formatDecimal(lastValues.Lmin),
          Lmax:
            row.Lmax !== null
              ? formatDecimal(row.Lmax)
              : formatDecimal(lastValues.Lmax),
          created_at: formatDate(timeToFormat),
        };
      });
    } else {
      // For specific report types, only include relevant fields
      formattedResults = results.map((row) => {
        const timeToFormat = row.local_time || row.created_at;
        const formattedDate = formatDate(timeToFormat);

        // Create object with ID and timestamp
        const baseObj = {
          id: row.id,
          created_at: formattedDate,
        };

        // Add only relevant fields based on report type
        switch (reportType) {
          case "laeq":
            return {
              ...baseObj,
              laeq: formatDecimal(row.laeq),
            };
          case "percentiles":
            return {
              ...baseObj,
              L10: formatDecimal(row.L10),
              L50: formatDecimal(row.L50),
              L90: formatDecimal(row.L90),
            };
          case "extremes":
            return {
              ...baseObj,
              Lmin: formatDecimal(row.Lmin),
              Lmax: formatDecimal(row.Lmax),
            };
          default:
            return baseObj;
        }
      });
    }

    res.status(200).json(formattedResults);
  } catch (error) {
    console.error("Error fetching data:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch data", details: error.message });
  }
});

// Export endpoint that generates Excel or PDF files
router.get("/export", async (req, res) => {
  const { reportType, format, days = 1 } = req.query;

  try {
    // Parse days parameter with fallback to 1
    const daysNum = parseInt(days, 10) || 1;
    const timeCondition = `WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${daysNum} DAY)`;

    // Build query based on report type
    let query;
    let reportTitle;
    let columns = [];

    switch (reportType) {
      case "laeq":
        reportTitle = "LAeq Sound Level Report";
        columns = [
          { header: "ID", key: "id", width: 10 },
          { header: "LAeq (dB)", key: "laeq", width: 15 },
          { header: "Created At", key: "created_at", width: 20 },
        ];
        query = `
          SELECT id, value as laeq, created_at, CONVERT_TZ(created_at, '+00:00', '+08:00') as local_time 
          FROM laeq 
          ${timeCondition}
          ORDER BY created_at DESC`;
        break;
      case "percentiles":
        reportTitle = "Sound Level Percentiles Report";
        columns = [
          { header: "ID", key: "id", width: 10 },
          { header: "L10 (dB)", key: "L10", width: 15 },
          { header: "L50 (dB)", key: "L50", width: 15 },
          { header: "L90 (dB)", key: "L90", width: 15 },
          { header: "Created At", key: "created_at", width: 20 },
        ];
        query = `
          SELECT id, L10, L50, L90, created_at, CONVERT_TZ(created_at, '+00:00', '+08:00') as local_time 
          FROM laeq_metrics 
          ${timeCondition}
          ORDER BY created_at DESC`;
        break;
      case "extremes":
        reportTitle = "Sound Level Extremes Report";
        columns = [
          { header: "ID", key: "id", width: 10 },
          { header: "Lmin (dB)", key: "Lmin", width: 15 },
          { header: "Lmax (dB)", key: "Lmax", width: 15 },
          { header: "Created At", key: "created_at", width: 20 },
        ];
        query = `
          SELECT id, Lmin, Lmax, created_at, CONVERT_TZ(created_at, '+00:00', '+08:00') as local_time 
          FROM laeq_lmin_lmax 
          ${timeCondition}
          ORDER BY created_at DESC`;
        break;
      case "all":
      default:
        reportTitle = "Complete Sound Level Report";
        columns = [
          { header: "ID", key: "id", width: 10 },
          { header: "LAeq (dB)", key: "laeq", width: 15 },
          { header: "L10 (dB)", key: "L10", width: 15 },
          { header: "L50 (dB)", key: "L50", width: 15 },
          { header: "L90 (dB)", key: "L90", width: 15 },
          { header: "Lmin (dB)", key: "Lmin", width: 15 },
          { header: "Lmax (dB)", key: "Lmax", width: 15 },
          { header: "Created At", key: "created_at", width: 20 },
        ];
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

    if (results.length === 0) {
      return res
        .status(404)
        .json({ error: "No data found for the given parameters" });
    }

    let formattedResults;

    // For the "all" report type, use special logic
    if (reportType === "all") {
      // Track the latest values for each parameter
      let lastValues = {
        laeq: null,
        L10: null,
        L50: null,
        L90: null,
        Lmin: null,
        Lmax: null,
      };

      // First find the most recent value for each parameter
      results.forEach((row) => {
        if (row.laeq !== null && lastValues.laeq === null)
          lastValues.laeq = row.laeq;
        if (row.L10 !== null && lastValues.L10 === null)
          lastValues.L10 = row.L10;
        if (row.L50 !== null && lastValues.L50 === null)
          lastValues.L50 = row.L50;
        if (row.L90 !== null && lastValues.L90 === null)
          lastValues.L90 = row.L90;
        if (row.Lmin !== null && lastValues.Lmin === null)
          lastValues.Lmin = row.Lmin;
        if (row.Lmax !== null && lastValues.Lmax === null)
          lastValues.Lmax = row.Lmax;
      });

      // Format results with proper null handling
      formattedResults = results.map((row) => {
        const timeToFormat = row.local_time || row.db_time;

        // Update the latest known values as we process rows
        if (row.laeq !== null) lastValues.laeq = row.laeq;
        if (row.L10 !== null) lastValues.L10 = row.L10;
        if (row.L50 !== null) lastValues.L50 = row.L50;
        if (row.L90 !== null) lastValues.L90 = row.L90;
        if (row.Lmin !== null) lastValues.Lmin = row.Lmin;
        if (row.Lmax !== null) lastValues.Lmax = row.Lmax;

        return {
          id: row.id,
          laeq:
            row.laeq !== null
              ? formatDecimal(row.laeq)
              : formatDecimal(lastValues.laeq),
          L10:
            row.L10 !== null
              ? formatDecimal(row.L10)
              : formatDecimal(lastValues.L10),
          L50:
            row.L50 !== null
              ? formatDecimal(row.L50)
              : formatDecimal(lastValues.L50),
          L90:
            row.L90 !== null
              ? formatDecimal(row.L90)
              : formatDecimal(lastValues.L90),
          Lmin:
            row.Lmin !== null
              ? formatDecimal(row.Lmin)
              : formatDecimal(lastValues.Lmin),
          Lmax:
            row.Lmax !== null
              ? formatDecimal(row.Lmax)
              : formatDecimal(lastValues.Lmax),
          created_at: formatDate(timeToFormat),
        };
      });
    } else {
      // For specific report types, format appropriately
      formattedResults = results.map((row) => {
        const timeToFormat = row.local_time || row.created_at;
        const baseObj = {
          id: row.id,
          created_at: formatDate(timeToFormat),
        };

        // Add only relevant fields based on report type
        switch (reportType) {
          case "laeq":
            return {
              ...baseObj,
              laeq: formatDecimal(row.laeq),
            };
          case "percentiles":
            return {
              ...baseObj,
              L10: formatDecimal(row.L10),
              L50: formatDecimal(row.L50),
              L90: formatDecimal(row.L90),
            };
          case "extremes":
            return {
              ...baseObj,
              Lmin: formatDecimal(row.Lmin),
              Lmax: formatDecimal(row.Lmax),
            };
          default:
            return baseObj;
        }
      });
    }

    // Generate filename with date
    const currentDate = new Date().toISOString().slice(0, 10);
    const filename = `noise_report_${reportType}_${currentDate}`;

    if (format === "excel") {
      await generateExcel(
        res,
        formattedResults,
        reportTitle,
        filename,
        columns
      );
    } else if (format === "pdf") {
      generatePDF(res, formattedResults, reportTitle, filename, reportType);
    } else {
      res
        .status(400)
        .json({ error: "Invalid format. Please use 'excel' or 'pdf'" });
    }
  } catch (error) {
    console.error("Error exporting data:", error);
    res
      .status(500)
      .json({ error: "Failed to export data", details: error.message });
  }
});

// Helper function to format decimal numbers
function formatDecimal(value) {
  if (value === null || value === undefined) return null;
  return parseFloat(value).toFixed(2);
}

// Helper function to format dates
function formatDate(dateObj) {
  if (!dateObj) return null;

  const date = new Date(dateObj);
  return date.toLocaleString("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Helper function to generate Excel report
async function generateExcel(res, data, title, filename, columns) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Noise IoT System";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Report Data");

  // Add title row
  const titleCell = "A1";
  worksheet.mergeCells(
    `${titleCell}:${String.fromCharCode(65 + columns.length - 1)}1`
  );
  const titleRow = worksheet.getCell(titleCell);
  titleRow.value = title;
  titleRow.font = { size: 16, bold: true };
  titleRow.alignment = { horizontal: "center" };

  // Add date information
  const dateCell = "A2";
  worksheet.mergeCells(
    `${dateCell}:${String.fromCharCode(65 + columns.length - 1)}2`
  );
  const dateRow = worksheet.getCell(dateCell);
  dateRow.value = `Report generated on: ${new Date().toLocaleString("id-ID")}`;
  dateRow.font = { size: 12, italic: true };
  dateRow.alignment = { horizontal: "center" };

  // Empty row
  worksheet.addRow([]);

  // Set columns
  worksheet.columns = columns;

  // Add headers with styling
  const headerRow = worksheet.addRow(columns.map((col) => col.header));

  headerRow.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // Add data rows
  data.forEach((row) => {
    const rowData = columns.map((col) => row[col.key]);
    const dataRow = worksheet.addRow(rowData);

    // Add basic styling to data cells
    dataRow.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  });

  // Set headers and send response
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename=${filename}.xlsx`);

  // Write to buffer and send
  const buffer = await workbook.xlsx.writeBuffer();
  res.send(buffer);
}

// Helper function to generate PDF report
function generatePDF(res, data, title, filename, reportType) {
  const doc = new PDFDocument({ margin: 50 });
  const buffers = [];

  doc.on("data", buffers.push.bind(buffers));
  doc.on("end", () => {
    const pdfData = Buffer.concat(buffers);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${filename}.pdf`
    );
    res.send(pdfData);
  });

  // Add document title
  doc.fontSize(20).text(title, { align: "center" });
  doc.moveDown();

  // Add date
  doc
    .fontSize(12)
    .text(`Report generated on: ${new Date().toLocaleString("id-ID")}`, {
      align: "center",
    });
  doc.moveDown(2);

  // Define headers based on report type
  let headers = ["ID", "Created At"];
  if (reportType === "laeq" || reportType === "all") {
    headers.splice(1, 0, "LAeq (dB)");
  }
  if (reportType === "percentiles" || reportType === "all") {
    headers.splice(
      reportType === "all" ? 2 : 1,
      0,
      "L10 (dB)",
      "L50 (dB)",
      "L90 (dB)"
    );
  }
  if (reportType === "extremes" || reportType === "all") {
    headers.splice(reportType === "all" ? 5 : 1, 0, "Lmin (dB)", "Lmax (dB)");
  }

  // Define a reusable function for table layout
  const drawTableRow = (y, values, isHeader = false) => {
    const rowHeight = 25;
    const x = 50;
    let currentX = x;

    // Calculate column widths based on available space and number of columns
    const availableWidth = doc.page.width - 100;
    const colWidth = availableWidth / values.length;

    if (isHeader) {
      doc
        .rect(x, y, availableWidth, rowHeight)
        .fillAndStroke("#e0e0e0", "#000000");
      doc.fillColor("#000000");
    } else {
      doc.rect(x, y, availableWidth, rowHeight).stroke();
    }

    values.forEach((value, i) => {
      doc
        .fontSize(isHeader ? 11 : 10)
        .text(
          value !== null && value !== undefined ? value : "",
          currentX + 5,
          y + 7,
          { width: colWidth - 10, align: "left" }
        );
      currentX += colWidth;
    });

    return y + rowHeight;
  };

  // Create table header
  let y = 150;
  y = drawTableRow(y, headers, true);

  // Create table rows for data
  let rowsPerPage = 22; // Adjust based on your page size and font
  let rowCount = 0;

  data.forEach((row) => {
    // Extract values based on report type
    let values = [row.id];

    if (reportType === "laeq" || reportType === "all") {
      values.push(row.laeq);
    }

    if (reportType === "percentiles" || reportType === "all") {
      if (reportType === "percentiles") {
        values.push(row.L10, row.L50, row.L90);
      } else {
        values.push(row.L10, row.L50, row.L90);
      }
    }

    if (reportType === "extremes" || reportType === "all") {
      if (reportType === "extremes") {
        values.push(row.Lmin, row.Lmax);
      } else {
        values.push(row.Lmin, row.Lmax);
      }
    }

    values.push(row.created_at);

    y = drawTableRow(y, values);
    rowCount++;

    // Check if we need a new page
    if (rowCount >= rowsPerPage && data.indexOf(row) < data.length - 1) {
      doc.addPage();
      y = 50;
      y = drawTableRow(y, headers, true);
      rowCount = 0;
    }
  });

  // If there are many records, add a note
  if (data.length > 100) {
    doc.moveDown();
    doc
      .fontSize(10)
      .text(`Note: Report contains ${data.length} records in total.`, {
        align: "center",
        italics: true,
      });
  }

  doc.end();
}

module.exports = router;
