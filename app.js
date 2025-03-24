const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// Import routes
const laeqDataRoutes = require("./routes/laeqData");
const laeqHourlyRoutes = require("./routes/laeqLminLmax");
const laeqRealtimeRoutes = require("./routes/laeqMetrics");
const mqttStatusRoutes = require("./routes/mqttStatus");
const tblLaeqRoutes = require("./routes/Laeq");
const dashboardRoutes = require("./routes/dashboard");
const laeqHourlyRoutesNew = require("./routes/laeqHourly");
const exportRoutes = require("./routes/export"); // Import the new export route

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Use routes
app.use("/api/laeq-data", laeqDataRoutes);
app.use("/api/laeq-lmin-lmax", laeqHourlyRoutes);
app.use("/api/laeq-metrics", laeqRealtimeRoutes);
app.use("/api/mqtt-status", mqttStatusRoutes);
app.use("/api/laeq", tblLaeqRoutes);
app.use("/api/dashboard-summary", dashboardRoutes);
app.use("/api/laeq-hourly", laeqHourlyRoutesNew);
app.use("/api/export", exportRoutes); // Use the new export route

module.exports = app;
