require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const meetingRoutes = require("./routes/meetings");
const eventRoutes = require("./routes/events");
const policyRoutes = require("./routes/policies");
const documentRoutes = require("./routes/documents");
const minutesRoutes = require("./routes/minutes");
const activityLogRoutes = require("./routes/activityLogs");
const userRoutes = require("./routes/users");

const db = require("./db");

const app = express();

const PORT = process.env.PORT || 5000;

/* =========================================
   ALLOWED FRONTEND ORIGINS
========================================= */

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
  })
);

/* =========================================
   JSON BODY PARSER
========================================= */

app.use(
  express.json({
    limit: "1mb",
  })
);

/* =========================================
   API ROUTES
========================================= */

app.use("/api/auth", authRoutes);

app.use("/api/dashboard", dashboardRoutes);

app.use("/api/meetings", meetingRoutes);

app.use("/api/events", eventRoutes);

app.use("/api/policies", policyRoutes);

app.use("/api/documents", documentRoutes);

app.use("/api/minutes", minutesRoutes);

app.use("/api/activity-logs", activityLogRoutes);

/*
  ADMIN USER MANAGEMENT

  All routes inside users.js are protected by:
  - authenticateToken
  - requireRole("Admin")

  Only approved Admin accounts can manage users.
*/

app.use("/api/users", userRoutes);

/*
  IMPORTANT SECURITY NOTE:

  Do NOT make uploads publicly accessible.

  Documents must be downloaded through
  authenticated document routes.
*/

/* =========================================
   ROOT HEALTH CHECK
========================================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "EVENTRA / SmartInstitution backend is running",
  });
});

/* =========================================
   DATABASE HEALTH CHECK
========================================= */

app.get("/api/test-db", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT 1 AS connected"
    );

    return res.json({
      success: true,
      message: "MySQL connected successfully",
      result: rows,
    });
  } catch (error) {
    console.error("Database error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

/* =========================================
   404 HANDLER
========================================= */

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "API route not found.",
  });
});

/* =========================================
   GLOBAL ERROR HANDLER
========================================= */

app.use((err, req, res, next) => {
  console.error("Server error:", err.message);

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

/* =========================================
   START SERVER
========================================= */

app.listen(PORT, () => {
  console.log(
    `EVENTRA backend running on port ${PORT}`
  );
});