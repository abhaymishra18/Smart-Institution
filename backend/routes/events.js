const express = require("express");
const router = express.Router();

const db = require("../db");

const {
  authenticateToken,
  requireRole,
} = require("../middleware/auth");

const {
  createAuditLog,
} = require("../utils/auditLog");


// =====================================================
// GET ALL EVENTS
// =====================================================

router.get(
  "/",
  authenticateToken,
  async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT
          id,
          title,
          event_date,
          event_time,
          location,
          description,
          organizer,
          created_by,
          created_at
        FROM events
        ORDER BY event_date DESC, event_time DESC
      `);

      res.json({
        success: true,
        data: rows,
      });

    } catch (error) {
      console.error(
        "Get events error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Unable to load events.",
      });
    }
  }
);


// =====================================================
// GET SINGLE EVENT
// =====================================================

router.get(
  "/:id",
  authenticateToken,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
      }

      const [rows] = await db.query(
        `
        SELECT
          id,
          title,
          event_date,
          event_time,
          location,
          description,
          organizer,
          created_by,
          created_at
        FROM events
        WHERE id = ?
        `,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Event not found.",
        });
      }

      res.json({
        success: true,
        data: rows[0],
      });

    } catch (error) {
      console.error(
        "Get event error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Unable to load event.",
      });
    }
  }
);


// =====================================================
// CREATE EVENT
// Admin + Member
// =====================================================

router.post(
  "/",
  authenticateToken,
  requireRole("Admin", "Member"),
  async (req, res) => {

    try {

      const {
        title,
        event_date,
        event_time,
        location,
        description,
        organizer,
      } = req.body;


      // -----------------------------
      // VALIDATION
      // -----------------------------

      if (
        typeof title !== "string" ||
        !title.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Event title is required.",
        });
      }

      const cleanTitle =
        title.trim();

      if (cleanTitle.length > 200) {
        return res.status(400).json({
          success: false,
          message:
            "Event title is too long.",
        });
      }

      if (!event_date) {
        return res.status(400).json({
          success: false,
          message:
            "Event date is required.",
        });
      }


      // -----------------------------
      // SECURITY
      // -----------------------------

      // Never trust created_by
      // from frontend.

      const createdBy =
        req.user.id;


      // -----------------------------
      // INSERT
      // -----------------------------

      const [result] =
        await db.query(
          `
          INSERT INTO events
          (
            title,
            event_date,
            event_time,
            location,
            description,
            organizer,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            cleanTitle,
            event_date,
            event_time || null,

            typeof location === "string"
              ? location
                  .trim()
                  .slice(0, 255)
              : null,

            typeof description === "string"
              ? description
                  .trim()
                  .slice(0, 5000)
              : null,

            typeof organizer === "string"
              ? organizer
                  .trim()
                  .slice(0, 255)
              : null,

            createdBy,
          ]
        );


      const eventId =
        result.insertId;


      // -----------------------------
      // AUDIT LOG
      // -----------------------------

      await createAuditLog({
        req,
        action: "CREATE",
        module: "Events",
        recordId: eventId,
        description:
          `Created event "${cleanTitle}"`,
      });


      res.status(201).json({
        success: true,
        message:
          "Event created successfully.",
        data: {
          id: eventId,
        },
      });

    } catch (error) {

      console.error(
        "Create event error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to create event.",
      });
    }
  }
);


// =====================================================
// UPDATE EVENT
// Admin + Member
// =====================================================

router.put(
  "/:id",
  authenticateToken,
  requireRole("Admin", "Member"),
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);


      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid event ID.",
        });
      }


      const {
        title,
        event_date,
        event_time,
        location,
        description,
        organizer,
      } = req.body;


      // -----------------------------
      // VALIDATION
      // -----------------------------

      if (
        typeof title !== "string" ||
        !title.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Event title is required.",
        });
      }

      const cleanTitle =
        title.trim();

      if (cleanTitle.length > 200) {
        return res.status(400).json({
          success: false,
          message:
            "Event title is too long.",
        });
      }

      if (!event_date) {
        return res.status(400).json({
          success: false,
          message:
            "Event date is required.",
        });
      }


      // -----------------------------
      // UPDATE
      // -----------------------------

      const [result] =
        await db.query(
          `
          UPDATE events
          SET
            title = ?,
            event_date = ?,
            event_time = ?,
            location = ?,
            description = ?,
            organizer = ?
          WHERE id = ?
          `,
          [
            cleanTitle,
            event_date,
            event_time || null,

            typeof location === "string"
              ? location
                  .trim()
                  .slice(0, 255)
              : null,

            typeof description === "string"
              ? description
                  .trim()
                  .slice(0, 5000)
              : null,

            typeof organizer === "string"
              ? organizer
                  .trim()
                  .slice(0, 255)
              : null,

            id,
          ]
        );


      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Event not found.",
        });
      }


      // -----------------------------
      // AUDIT LOG
      // -----------------------------

      await createAuditLog({
        req,
        action: "UPDATE",
        module: "Events",
        recordId: id,
        description:
          `Updated event "${cleanTitle}"`,
      });


      res.json({
        success: true,
        message:
          "Event updated successfully.",
      });

    } catch (error) {

      console.error(
        "Update event error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to update event.",
      });
    }
  }
);


// =====================================================
// DELETE EVENT
// Admin only
// =====================================================

router.delete(
  "/:id",
  authenticateToken,
  requireRole("Admin"),
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);


      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid event ID.",
        });
      }


      // -----------------------------
      // GET EVENT BEFORE DELETE
      // -----------------------------

      const [events] =
        await db.query(
          `
          SELECT
            id,
            title
          FROM events
          WHERE id = ?
          LIMIT 1
          `,
          [id]
        );


      if (events.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Event not found.",
        });
      }


      const eventTitle =
        events[0].title;


      // -----------------------------
      // DELETE
      // -----------------------------

      const [result] =
        await db.query(
          "DELETE FROM events WHERE id = ?",
          [id]
        );


      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Event not found.",
        });
      }


      // -----------------------------
      // AUDIT LOG
      // -----------------------------

      await createAuditLog({
        req,
        action: "DELETE",
        module: "Events",
        recordId: id,
        description:
          `Deleted event "${eventTitle}"`,
      });


      res.json({
        success: true,
        message:
          "Event deleted successfully.",
      });

    } catch (error) {

      console.error(
        "Delete event error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to delete event.",
      });
    }
  }
);


module.exports = router;