const express = require("express");
const router = express.Router();

const db = require("../db");

const {
  authenticateToken,
  requireRole,
} = require("../middleware/auth");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.5-flash";

/* ===============================
   HELPERS
=============================== */

function getValidId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function cleanText(value, maxLength = 20000) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

/* ===============================
   LOAD MINUTES
   Login required
=============================== */

router.get(
  "/meeting/:meetingId",
  authenticateToken,
  async (req, res) => {
    try {
      const meetingId = getValidId(
        req.params.meetingId
      );

      if (!meetingId) {
        return res.status(400).json({
          success: false,
          message: "Invalid meeting ID.",
        });
      }

      const [rows] = await db.query(
        `
        SELECT
          id,
          meeting_id,
          summary,
          key_points,
          decisions,
          action_items,
          status,
          version,
          created_by,
          updated_by,
          created_at,
          updated_at
        FROM meeting_minutes
        WHERE meeting_id = ?
        ORDER BY id DESC
        LIMIT 1
        `,
        [meetingId]
      );

      return res.json({
        success: true,
        data: rows.length ? rows[0] : null,
      });
    } catch (error) {
      console.error(
        "LOAD MINUTES ERROR:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Unable to load minutes.",
      });
    }
  }
);

/* ===============================
   AI GENERATE DRAFT
   Admin + Member
=============================== */

router.post(
  "/meeting/:meetingId/generate-draft",
  authenticateToken,
  requireRole("Admin", "Member"),
  async (req, res) => {
    try {
      const meetingId = getValidId(
        req.params.meetingId
      );

      if (!meetingId) {
        return res.status(400).json({
          success: false,
          message: "Invalid meeting ID.",
        });
      }

      if (!GEMINI_API_KEY) {
        return res.status(500).json({
          success: false,
          message:
            "Gemini API key is not configured on the server.",
        });
      }

      /* ---------- MEETING ---------- */

      const [meetingRows] = await db.query(
        `
        SELECT
          id,
          title,
          event_date,
          event_time,
          location,
          description,
          organizer
        FROM meetings
        WHERE id = ?
        LIMIT 1
        `,
        [meetingId]
      );

      if (meetingRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Meeting not found.",
        });
      }

      const meeting = meetingRows[0];

      /* ---------- TRANSCRIPT ---------- */

      const [transcriptRows] = await db.query(
        `
        SELECT
          start_time AS start,
          end_time AS end,
          speaker,
          transcript_text AS text
        FROM meeting_transcripts
        WHERE meeting_id = ?
        ORDER BY start_time ASC, id ASC
        `,
        [meetingId]
      );

      if (transcriptRows.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "No transcript found. Generate and save a transcript first.",
        });
      }

      /*
        Limit transcript sent to Gemini.
      */

      const transcriptText = transcriptRows
        .map((item) => {
          const start = Number(
            item.start || 0
          ).toFixed(2);

          const end = Number(
            item.end || 0
          ).toFixed(2);

          return `[${start}s - ${end}s] ${cleanText(
            item.speaker,
            100
          )}: ${cleanText(item.text, 5000)}`;
        })
        .join("\n")
        .slice(0, 120000);

      /* ---------- PROMPT ---------- */

      const prompt = `
You are an institutional meeting-minutes assistant.

Create a factual DRAFT of official meeting minutes from the supplied meeting information and transcript.

LANGUAGE RULE:
- The transcript may be in Hindi, English, or Hinglish.
- ALWAYS generate the final meeting minutes in clear, professional English.
- If the transcript is in Hindi, translate the relevant information into English while preserving the exact meaning.
- If the transcript is in Hinglish, convert it into professional English.
- Do not change names, numbers, dates, decisions, responsibilities, or deadlines.
- Do not invent information that is not present in the transcript.

IMPORTANT RULES:
1. Do not invent facts.
2. Do not create names, dates, decisions, deadlines, or responsibilities that are not present.
3. If information is not available, say "Not specified in transcript."
4. Preserve uncertainty.
5. This is an AI DRAFT and will be reviewed by a human.
6. Keep the language professional and concise.
7. Decisions must contain only decisions actually stated or clearly agreed.
8. Action items must contain only actions actually assigned or clearly requested.
9. Do not treat questions as decisions.
10. Do not treat suggestions as approved decisions.

Return ONLY valid JSON with exactly these four fields:

{
  "summary": "...",
  "key_points": "...",
  "decisions": "...",
  "action_items": "..."
}

For lists, use numbered lines or bullet-style lines inside the string.

MEETING:
Title: ${cleanText(meeting.title, 300)}
Date: ${meeting.event_date || "Not specified"}
Time: ${meeting.event_time || "Not specified"}
Location: ${
        cleanText(meeting.location, 300) ||
        "Not specified"
      }
Organizer: ${
        cleanText(meeting.organizer, 300) ||
        "Not specified"
      }
Description: ${
        cleanText(meeting.description, 3000) ||
        "Not specified"
      }

TRANSCRIPT:
${transcriptText}
`;

      /* ---------- GEMINI REQUEST ---------- */

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
          },

          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],

            generationConfig: {
              temperature: 0.2,
              responseMimeType:
                "application/json",
            },
          }),
        }
      );

      const geminiData =
        await response.json();

      if (!response.ok) {
        console.error(
          "GEMINI ERROR:",
          geminiData
        );

        return res.status(502).json({
          success: false,
          message:
            "AI service failed to generate minutes.",
        });
      }

      const generatedText =
        geminiData?.candidates?.[0]
          ?.content?.parts?.[0]?.text;

      if (!generatedText) {
        return res.status(502).json({
          success: false,
          message:
            "AI returned an empty response.",
        });
      }

      /* ---------- PARSE JSON ---------- */

      let draft;

      try {
        draft = JSON.parse(generatedText);
      } catch (parseError) {
        console.error(
          "GEMINI JSON PARSE ERROR:",
          generatedText
        );

        return res.status(502).json({
          success: false,
          message:
            "AI returned invalid draft data.",
        });
      }

      /* ---------- VALIDATE AI OUTPUT ---------- */

      const result = {
        summary: cleanText(draft.summary),
        key_points: cleanText(
          draft.key_points
        ),
        decisions: cleanText(
          draft.decisions
        ),
        action_items: cleanText(
          draft.action_items
        ),
      };

      return res.json({
        success: true,
        message:
          "AI minutes draft generated successfully.",
        draft: result,
        aiDraft: true,
        humanReviewRequired: true,
      });
    } catch (error) {
      console.error(
        "GENERATE MINUTES DRAFT ERROR:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to generate AI minutes draft.",
      });
    }
  }
);

/* ===============================
   CREATE DRAFT
   Admin + Member
=============================== */

router.post(
  "/meeting/:meetingId",
  authenticateToken,
  requireRole("Admin", "Member"),
  async (req, res) => {
    try {
      const meetingId = getValidId(
        req.params.meetingId
      );

      if (!meetingId) {
        return res.status(400).json({
          success: false,
          message: "Invalid meeting ID.",
        });
      }

      const summary = cleanText(
        req.body.summary
      );

      const keyPoints = cleanText(
        req.body.key_points
      );

      const decisions = cleanText(
        req.body.decisions
      );

      const actionItems = cleanText(
        req.body.action_items
      );

      /*
        IMPORTANT:
        Never trust req.body.created_by.
        User identity comes from verified JWT.
      */
      const createdBy = req.user.id;

      /* ---------- VERIFY MEETING ---------- */

      const [meetingRows] = await db.query(
        `
        SELECT id
        FROM meetings
        WHERE id = ?
        LIMIT 1
        `,
        [meetingId]
      );

      if (meetingRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Meeting not found.",
        });
      }

      /* ---------- CHECK EXISTING ---------- */

      const [existing] = await db.query(
        `
        SELECT id
        FROM meeting_minutes
        WHERE meeting_id = ?
        LIMIT 1
        `,
        [meetingId]
      );

      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          message:
            "Minutes draft already exists.",
        });
      }

      /* ---------- CREATE ---------- */

      const [result] = await db.query(
        `
        INSERT INTO meeting_minutes
        (
          meeting_id,
          summary,
          key_points,
          decisions,
          action_items,
          status,
          version,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, 'Draft', '1.0', ?)
        `,
        [
          meetingId,
          summary,
          keyPoints,
          decisions,
          actionItems,
          createdBy,
        ]
      );

      return res.status(201).json({
        success: true,
        message:
          "Minutes draft created successfully.",
        id: result.insertId,
      });
    } catch (error) {
      console.error(
        "CREATE MINUTES ERROR:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to create minutes draft.",
      });
    }
  }
);

/* ===============================
   UPDATE DRAFT
   Admin + Member
=============================== */

router.put(
  "/:id",
  authenticateToken,
  requireRole("Admin", "Member"),
  async (req, res) => {
    try {
      const id = getValidId(
        req.params.id
      );

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid minutes ID.",
        });
      }

      const summary = cleanText(
        req.body.summary
      );

      const keyPoints = cleanText(
        req.body.key_points
      );

      const decisions = cleanText(
        req.body.decisions
      );

      const actionItems = cleanText(
        req.body.action_items
      );

      /*
        Never trust req.body.updated_by.
      */
      const updatedBy = req.user.id;

      const [rows] = await db.query(
        `
        SELECT
          status,
          version
        FROM meeting_minutes
        WHERE id = ?
        LIMIT 1
        `,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Minutes not found.",
        });
      }

      if (rows[0].status === "Approved") {
        return res.status(409).json({
          success: false,
          message:
            "Approved minutes cannot be edited.",
        });
      }

      /*
        Version:
        1.0 -> 1.1
        1.1 -> 1.2
        1.9 -> 1.10
      */
      const currentVersion =
        String(rows[0].version || "1.0");

      const versionParts =
        currentVersion.split(".");

      const major =
        Number(versionParts[0]) || 1;

      const minor =
        Number(versionParts[1]) || 0;

      const newVersion =
        `${major}.${minor + 1}`;

      await db.query(
        `
        UPDATE meeting_minutes
        SET
          summary = ?,
          key_points = ?,
          decisions = ?,
          action_items = ?,
          updated_by = ?,
          version = ?
        WHERE id = ?
        `,
        [
          summary,
          keyPoints,
          decisions,
          actionItems,
          updatedBy,
          newVersion,
          id,
        ]
      );

      return res.json({
        success: true,
        message:
          "Minutes draft updated successfully.",
        version: newVersion,
      });
    } catch (error) {
      console.error(
        "UPDATE MINUTES ERROR:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update minutes.",
      });
    }
  }
);

/* ===============================
   APPROVE
   ADMIN ONLY
=============================== */

router.patch(
  "/:id/approve",
  authenticateToken,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const id = getValidId(
        req.params.id
      );

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid minutes ID.",
        });
      }

      /*
        Approval identity comes from JWT.
      */
      const updatedBy = req.user.id;

      const [rows] = await db.query(
        `
        SELECT status
        FROM meeting_minutes
        WHERE id = ?
        LIMIT 1
        `,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Minutes not found.",
        });
      }

      if (rows[0].status === "Approved") {
        return res.status(409).json({
          success: false,
          message:
            "Minutes are already approved.",
        });
      }

      await db.query(
        `
        UPDATE meeting_minutes
        SET
          status = 'Approved',
          updated_by = ?
        WHERE id = ?
        `,
        [updatedBy, id]
      );

      return res.json({
        success: true,
        message:
          "Minutes approved successfully.",
      });
    } catch (error) {
      console.error(
        "APPROVE MINUTES ERROR:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to approve minutes.",
      });
    }
  }
);

/* ===============================
   DELETE DRAFT
   ADMIN ONLY
=============================== */

router.delete(
  "/:id",
  authenticateToken,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const id = getValidId(
        req.params.id
      );

      if (!id) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid minutes ID.",
        });
      }

      const [rows] = await db.query(
        `
        SELECT status
        FROM meeting_minutes
        WHERE id = ?
        LIMIT 1
        `,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Minutes not found.",
        });
      }

      if (rows[0].status === "Approved") {
        return res.status(409).json({
          success: false,
          message:
            "Approved minutes cannot be deleted.",
        });
      }

      await db.query(
        `
        DELETE FROM meeting_minutes
        WHERE id = ?
        `,
        [id]
      );

      return res.json({
        success: true,
        message:
          "Minutes draft deleted successfully.",
      });
    } catch (error) {
      console.error(
        "DELETE MINUTES ERROR:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to delete minutes.",
      });
    }
  }
);

module.exports = router;