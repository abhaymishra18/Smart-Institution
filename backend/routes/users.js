const express = require("express");
const db = require("../db");

const {
  authenticateToken,
  requireRole,
} = require("../middleware/auth");

const { createAuditLog } = require("../utils/auditLog");

const router = express.Router();

router.use(authenticateToken);
router.use(requireRole("Admin"));

const validRoles = ["Admin", "Member", "Viewer"];

/* =========================
   GET ALL USERS
========================= */

router.get("/", async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT
         id,
         name,
         email,
         role,
         account_status,
         created_at,
         approved_by,
         approved_at
       FROM users
       ORDER BY
         CASE account_status
           WHEN 'Pending' THEN 1
           WHEN 'Approved' THEN 2
           WHEN 'Blocked' THEN 3
           ELSE 4
         END,
         created_at DESC`
    );

    return res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Get users error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch users.",
    });
  }
});

/* =========================
   APPROVE USER
========================= */

router.patch("/:id/approve", async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const [result] = await db.query(
      `UPDATE users
       SET account_status = 'Approved',
           approved_by = ?,
           approved_at = CURRENT_TIMESTAMP,
           token_version = token_version + 1
       WHERE id = ?
         AND account_status = 'Pending'`,
      [req.user.id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Pending user not found.",
      });
    }

    await createAuditLog({
      req,
      action: "APPROVE",
      module: "USER_MANAGEMENT",
      recordId: userId,
      description: `Admin approved user ID ${userId}.`,
    });

    return res.json({
      success: true,
      message: "User approved successfully.",
    });
  } catch (error) {
    console.error("Approve user error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to approve user.",
    });
  }
});

/* =========================
   BLOCK USER
========================= */

router.patch("/:id/block", async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot block your own account.",
      });
    }

    const [targetUsers] = await db.query(
      `SELECT id, role, account_status
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (targetUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const target = targetUsers[0];

    if (target.account_status === "Deleted") {
      return res.status(400).json({
        success: false,
        message: "Deleted users cannot be blocked.",
      });
    }

    if (
      target.role === "Admin" &&
      target.account_status === "Approved"
    ) {
      const [admins] = await db.query(
        `SELECT COUNT(*) AS total
         FROM users
         WHERE role = 'Admin'
           AND account_status = 'Approved'`
      );

      if (Number(admins[0].total) <= 1) {
        return res.status(400).json({
          success: false,
          message: "The last active Admin cannot be blocked.",
        });
      }
    }

    const [result] = await db.query(
      `UPDATE users
       SET account_status = 'Blocked',
           token_version = token_version + 1
       WHERE id = ?
         AND account_status NOT IN ('Blocked', 'Deleted')`,
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "User is already blocked or deleted.",
      });
    }

    await createAuditLog({
      req,
      action: "BLOCK",
      module: "USER_MANAGEMENT",
      recordId: userId,
      description: `Admin blocked user ID ${userId}.`,
    });

    return res.json({
      success: true,
      message: "User blocked successfully.",
    });
  } catch (error) {
    console.error("Block user error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to block user.",
    });
  }
});

/* =========================
   REACTIVATE BLOCKED USER
========================= */

router.patch("/:id/reactivate", async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const [result] = await db.query(
      `UPDATE users
       SET account_status = 'Approved',
           approved_by = ?,
           approved_at = CURRENT_TIMESTAMP,
           token_version = token_version + 1
       WHERE id = ?
         AND account_status = 'Blocked'`,
      [req.user.id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Blocked user not found.",
      });
    }

    await createAuditLog({
      req,
      action: "REACTIVATE",
      module: "USER_MANAGEMENT",
      recordId: userId,
      description: `Admin reactivated user ID ${userId}.`,
    });

    return res.json({
      success: true,
      message: "User reactivated successfully.",
    });
  } catch (error) {
    console.error("Reactivate user error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to reactivate user.",
    });
  }
});

/* =========================
   CHANGE USER ROLE
========================= */

router.patch("/:id/role", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { role } = req.body || {};

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role.",
      });
    }

    if (userId === req.user.id && role !== "Admin") {
      return res.status(400).json({
        success: false,
        message: "You cannot remove your own Admin role.",
      });
    }

    const [targetUsers] = await db.query(
      `SELECT id, role, account_status
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [userId]
    );

    if (targetUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const target = targetUsers[0];

    if (target.account_status === "Deleted") {
      return res.status(400).json({
        success: false,
        message: "Deleted users cannot have their role changed.",
      });
    }

    if (
      target.role === "Admin" &&
      role !== "Admin" &&
      target.account_status === "Approved"
    ) {
      const [admins] = await db.query(
        `SELECT COUNT(*) AS total
         FROM users
         WHERE role = 'Admin'
           AND account_status = 'Approved'`
      );

      if (Number(admins[0].total) <= 1) {
        return res.status(400).json({
          success: false,
          message: "The last active Admin cannot be demoted.",
        });
      }
    }

    const [result] = await db.query(
      `UPDATE users
       SET role = ?,
           token_version = token_version + 1
       WHERE id = ?
         AND role <> ?
         AND account_status <> 'Deleted'`,
      [role, userId, role]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: "User already has this role or is deleted.",
      });
    }

    await createAuditLog({
      req,
      action: "ROLE_CHANGE",
      module: "USER_MANAGEMENT",
      recordId: userId,
      description: `Admin changed user ID ${userId} role to ${role}.`,
    });

    return res.json({
      success: true,
      message: "User role updated successfully.",
    });
  } catch (error) {
    console.error("Role update error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update user role.",
    });
  }
});

/* =========================
   RESTORE DELETED USER
========================= */

router.patch("/:id/restore", async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const [result] = await db.query(
      `UPDATE users
       SET account_status = 'Blocked',
           token_version = token_version + 1
       WHERE id = ?
         AND account_status = 'Deleted'`,
      [userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Removed user not found.",
      });
    }

    await createAuditLog({
      req,
      action: "RESTORE",
      module: "USER_MANAGEMENT",
      recordId: userId,
      description: `Admin restored user ID ${userId}.`,
    });

    return res.json({
      success: true,
      message: "User restored successfully. Reactivate the account to allow access.",
    });
  } catch (error) {
    console.error("Restore user error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to restore user.",
    });
  }
});

/* =========================
   REMOVE USER (SOFT DELETE)
========================= */

router.delete("/:id", async (req, res) => {
  let connection;

  try {
    const userId = Number(req.params.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot remove your own account.",
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [targetUsers] = await connection.query(
      `SELECT id, name, role, account_status
       FROM users
       WHERE id = ?
       FOR UPDATE`,
      [userId]
    );

    if (targetUsers.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const target = targetUsers[0];

    if (target.account_status === "Deleted") {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "User is already removed.",
      });
    }

    if (
      target.role === "Admin" &&
      target.account_status === "Approved"
    ) {
      const [admins] = await connection.query(
        `SELECT id
         FROM users
         WHERE role = 'Admin'
           AND account_status = 'Approved'
         FOR UPDATE`
      );

      if (admins.length <= 1) {
        await connection.rollback();

        return res.status(400).json({
          success: false,
          message: "The last active Admin cannot be removed.",
        });
      }
    }

    const [result] = await connection.query(
      `UPDATE users
       SET account_status = 'Deleted',
           token_version = token_version + 1
       WHERE id = ?
         AND account_status <> 'Deleted'`,
      [userId]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();

      return res.status(400).json({
        success: false,
        message: "Unable to remove this user.",
      });
    }

    await connection.commit();

    await createAuditLog({
      req,
      action: "DELETE",
      module: "USER_MANAGEMENT",
      recordId: userId,
      description: `Admin removed user ID ${userId}.`,
    });

    return res.json({
      success: true,
      message: "User removed successfully.",
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError.message);
      }
    }

    console.error("Remove user error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to remove user.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;