const express = require("express");
const db = require("../db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const [meetingRows] = await db.query(
      "SELECT COUNT(*) AS total FROM meetings"
    );

    const [eventRows] = await db.query(
      "SELECT COUNT(*) AS total FROM events"
    );

    const [policyRows] = await db.query(
      "SELECT COUNT(*) AS total FROM policies"
    );

    const [documentRows] = await db.query(
      "SELECT COUNT(*) AS total FROM documents"
    );

    res.json({
      success: true,
      data: {
        meetings: Number(meetingRows[0].total),
        events: Number(eventRows[0].total),
        policies: Number(policyRows[0].total),
        documents: Number(documentRows[0].total),
      },
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load dashboard statistics",
    });
  }
});

module.exports = router;