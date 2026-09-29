const express = require("express");
const db = require("../db");

const router = express.Router();

// =========================
// GET ALL MEETINGS
// =========================
router.get("/", async (req, res) => {
  try {
    const [meetings] = await db.query(`
      SELECT
        id,
        title,
        meeting_date,
        location,
        description,
        status,
        created_at,
        updated_at
      FROM meetings
      ORDER BY meeting_date DESC, id DESC
    `);

    res.json({
      success: true,
      data: meetings,
    });
  } catch (error) {
    console.error("Get meetings error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load meetings.",
    });
  }
});

// =========================
// GET SINGLE MEETING
// =========================
router.get("/:id", async (req, res) => {
  try {
    const meetingId = Number(req.params.id);

    if (!Number.isInteger(meetingId) || meetingId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid meeting ID.",
      });
    }

    const [meetings] = await db.query(
      `
      SELECT
        id,
        title,
        meeting_date,
        location,
        description,
        status,
        created_at,
        updated_at
      FROM meetings
      WHERE id = ?
      LIMIT 1
      `,
      [meetingId]
    );

    if (meetings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Meeting not found.",
      });
    }

    res.json({
      success: true,
      data: meetings[0],
    });
  } catch (error) {
    console.error("Get meeting error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load meeting.",
    });
  }
});

// =========================
// CREATE MEETING
// =========================
router.post("/", async (req, res) => {
  try {
    const {
      title,
      meeting_date,
      location,
      description,
      status,
    } = req.body;

    if (!title || !meeting_date) {
      return res.status(400).json({
        success: false,
        message: "Meeting title and date are required.",
      });
    }

    const cleanTitle = String(title).trim();

    if (cleanTitle.length < 3 || cleanTitle.length > 255) {
      return res.status(400).json({
        success: false,
        message: "Meeting title must be between 3 and 255 characters.",
      });
    }

    const allowedStatuses = [
      "Scheduled",
      "Completed",
      "Cancelled",
    ];

    const meetingStatus = allowedStatuses.includes(status)
      ? status
      : "Scheduled";

    const [result] = await db.query(
      `
      INSERT INTO meetings
      (
        title,
        meeting_date,
        location,
        description,
        status
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        cleanTitle,
        meeting_date,
        location ? String(location).trim() : null,
        description ? String(description).trim() : null,
        meetingStatus,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Meeting created successfully.",
      data: {
        id: result.insertId,
        title: cleanTitle,
        meeting_date,
        location: location ? String(location).trim() : null,
        description: description ? String(description).trim() : null,
        status: meetingStatus,
      },
    });
  } catch (error) {
    console.error("Create meeting error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to create meeting.",
    });
  }
});

// =========================
// EXPORT ROUTER
// =========================
module.exports = router;