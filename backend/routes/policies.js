const express = require("express");
const db = require("../db");

const {
  authenticateToken,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

/* =========================
   HELPERS
========================= */

function isPositiveInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

function cleanString(value, maxLength = 10000) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function isValidDate(value) {
  if (!value) return false;

  const date = new Date(value);

  return !Number.isNaN(date.getTime());
}

/* =========================
   GET ALL POLICIES
========================= */

router.get("/", authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        id,
        title,
        policy_number,
        department,
        description,
        effective_date,
        version,
        document_path,
        created_by,
        created_at
      FROM policies
      ORDER BY created_at DESC, id DESC
    `);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error("Get policies error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load policies.",
    });
  }
});

/* =========================
   GET SINGLE POLICY
========================= */

router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!isPositiveInteger(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid policy ID.",
      });
    }

    const [rows] = await db.query(
      `
      SELECT
        id,
        title,
        policy_number,
        department,
        description,
        effective_date,
        version,
        document_path,
        created_by,
        created_at
      FROM policies
      WHERE id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Policy not found.",
      });
    }

    res.json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("Get policy error:", error.message);

    res.status(500).json({
      success: false,
      message: "Unable to load policy.",
    });
  }
});

/* =========================
   CREATE POLICY
   Admin + Member
========================= */

router.post(
  "/",
  authenticateToken,
  requireRole("Admin", "Member"),
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      const title = cleanString(req.body.title, 200);

      const policyNumber = cleanString(
        req.body.policy_number,
        100
      );

      const department = cleanString(
        req.body.department,
        150
      );

      const description = cleanString(
        req.body.description,
        10000
      );

      const effectiveDate =
        req.body.effective_date || null;

      const documentPath = cleanString(
        req.body.document_path,
        255
      );

      if (!title) {
        return res.status(400).json({
          success: false,
          message: "Policy title is required.",
        });
      }

      if (
        effectiveDate &&
        !isValidDate(effectiveDate)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid effective date.",
        });
      }

      // IMPORTANT:
      // Never trust created_by from frontend.
      // Use authenticated user from JWT.
      const createdBy = req.user.id;

      await connection.beginTransaction();

      const initialVersion = "1.0";

      const [result] = await connection.query(
        `
        INSERT INTO policies
        (
          title,
          policy_number,
          department,
          description,
          effective_date,
          version,
          document_path,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          title,
          policyNumber || null,
          department || null,
          description || null,
          effectiveDate || null,
          initialVersion,
          documentPath || null,
          createdBy,
        ]
      );

      const policyId = result.insertId;

      await connection.query(
        `
        INSERT INTO policy_versions
        (
          policy_id,
          version,
          title,
          policy_number,
          department,
          description,
          effective_date,
          document_path,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          policyId,
          initialVersion,
          title,
          policyNumber || null,
          department || null,
          description || null,
          effectiveDate || null,
          documentPath || null,
          createdBy,
        ]
      );

      await connection.commit();

      res.status(201).json({
        success: true,
        message: "Policy created successfully.",
        data: {
          id: policyId,
          version: initialVersion,
        },
      });
    } catch (error) {
      await connection.rollback();

      console.error(
        "Create policy error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Unable to create policy.",
      });
    } finally {
      connection.release();
    }
  }
);

/* =========================
   UPDATE POLICY
   Admin + Member
========================= */

router.put(
  "/:id",
  authenticateToken,
  requireRole("Admin", "Member"),
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      const id = Number(req.params.id);

      if (!isPositiveInteger(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid policy ID.",
        });
      }

      const title = cleanString(req.body.title, 200);

      const policyNumber = cleanString(
        req.body.policy_number,
        100
      );

      const department = cleanString(
        req.body.department,
        150
      );

      const description = cleanString(
        req.body.description,
        10000
      );

      const effectiveDate =
        req.body.effective_date || null;

      const documentPath = cleanString(
        req.body.document_path,
        255
      );

      if (!title) {
        return res.status(400).json({
          success: false,
          message: "Policy title is required.",
        });
      }

      if (
        effectiveDate &&
        !isValidDate(effectiveDate)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid effective date.",
        });
      }

      // Authenticated user becomes the version creator.
      const updatedBy = req.user.id;

      await connection.beginTransaction();

      const [rows] = await connection.query(
        `
        SELECT
          id,
          version
        FROM policies
        WHERE id = ?
        FOR UPDATE
        `,
        [id]
      );

      if (rows.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          success: false,
          message: "Policy not found.",
        });
      }

      const currentVersion =
        String(rows[0].version || "1.0");

      const versionParts = currentVersion
        .split(".")
        .map(Number);

      const major =
        Number.isFinite(versionParts[0])
          ? versionParts[0]
          : 1;

      const minor =
        Number.isFinite(versionParts[1])
          ? versionParts[1]
          : 0;

      const newVersion =
        `${major}.${minor + 1}`;

      await connection.query(
        `
        UPDATE policies
        SET
          title = ?,
          policy_number = ?,
          department = ?,
          description = ?,
          effective_date = ?,
          version = ?,
          document_path = ?
        WHERE id = ?
        `,
        [
          title,
          policyNumber || null,
          department || null,
          description || null,
          effectiveDate || null,
          newVersion,
          documentPath || null,
          id,
        ]
      );

      await connection.query(
        `
        INSERT INTO policy_versions
        (
          policy_id,
          version,
          title,
          policy_number,
          department,
          description,
          effective_date,
          document_path,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          newVersion,
          title,
          policyNumber || null,
          department || null,
          description || null,
          effectiveDate || null,
          documentPath || null,
          updatedBy,
        ]
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Policy updated successfully.",
        data: {
          id,
          version: newVersion,
        },
      });
    } catch (error) {
      await connection.rollback();

      console.error(
        "Update policy error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Unable to update policy.",
      });
    } finally {
      connection.release();
    }
  }
);

/* =========================
   GET VERSION HISTORY
========================= */

router.get(
  "/:id/versions",
  authenticateToken,
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!isPositiveInteger(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid policy ID.",
        });
      }

      const [rows] = await db.query(
        `
        SELECT
          id,
          policy_id,
          version,
          title,
          policy_number,
          department,
          description,
          effective_date,
          document_path,
          created_by,
          created_at
        FROM policy_versions
        WHERE policy_id = ?
        ORDER BY created_at DESC, id DESC
        `,
        [id]
      );

      res.json({
        success: true,
        data: rows,
      });
    } catch (error) {
      console.error(
        "Get policy versions error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Unable to load policy history.",
      });
    }
  }
);

/* =========================
   DELETE POLICY
   Admin only
========================= */

router.delete(
  "/:id",
  authenticateToken,
  requireRole("Admin"),
  async (req, res) => {
    const connection = await db.getConnection();

    try {
      const id = Number(req.params.id);

      if (!isPositiveInteger(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid policy ID.",
        });
      }

      await connection.beginTransaction();

      const [rows] = await connection.query(
        `
        SELECT id
        FROM policies
        WHERE id = ?
        FOR UPDATE
        `,
        [id]
      );

      if (rows.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          success: false,
          message: "Policy not found.",
        });
      }

      await connection.query(
        `
        DELETE FROM policy_versions
        WHERE policy_id = ?
        `,
        [id]
      );

      await connection.query(
        `
        DELETE FROM policies
        WHERE id = ?
        `,
        [id]
      );

      await connection.commit();

      res.json({
        success: true,
        message: "Policy deleted successfully.",
      });
    } catch (error) {
      await connection.rollback();

      console.error(
        "Delete policy error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Unable to delete policy.",
      });
    } finally {
      connection.release();
    }
  }
);

module.exports = router;