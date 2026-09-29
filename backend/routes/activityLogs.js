const express = require("express");

const db = require("../db");
const {
  authenticateToken,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

/*
  GET ACTIVITY LOGS

  Admin only.
  Logs are never accepted from the frontend.
*/

router.get(
  "/",
  authenticateToken,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const requestedLimit = Number(
        req.query.limit
      );

      const requestedPage = Number(
        req.query.page
      );

      const limit =
        Number.isInteger(requestedLimit) &&
        requestedLimit > 0 &&
        requestedLimit <= 100
          ? requestedLimit
          : 50;

      const page =
        Number.isInteger(requestedPage) &&
        requestedPage > 0
          ? requestedPage
          : 1;

      const offset = (page - 1) * limit;

      const [rows] = await db.query(
        `
        SELECT
          id,
          user_id,
          user_name,
          user_role,
          action,
          module,
          record_id,
          description,
          created_at
        FROM activity_logs
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        `,
        [limit, offset]
      );

      const [countRows] = await db.query(
        `
        SELECT COUNT(*) AS total
        FROM activity_logs
        `
      );

      const total = Number(
        countRows[0]?.total || 0
      );

      res.json({
        success: true,
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages:
            Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error(
        "ACTIVITY LOG ERROR:",
        error.message
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to load activity logs.",
      });
    }
  }
);

module.exports = router;