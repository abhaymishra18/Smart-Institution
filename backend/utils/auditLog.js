const db = require("../db");

async function createAuditLog({
  req,
  action,
  module,
  recordId = null,
  description = "",
}) {
  try {
    if (!req?.user?.id) {
      console.error("AUDIT LOG: Authenticated user missing");
      return;
    }

    const userId = req.user.id;
    const userRole = req.user.role || "Unknown";

    const [users] = await db.query(
      `
      SELECT name
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [userId]
    );

    const userName =
      users.length > 0
        ? users[0].name
        : "Unknown User";

    await db.query(
      `
      INSERT INTO activity_logs
      (
        user_id,
        user_name,
        user_role,
        action,
        module,
        record_id,
        description
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        userName,
        userRole,
        action,
        module || null,
        recordId,
        description,
      ]
    );
  } catch (error) {
    console.error("AUDIT LOG ERROR:", error.message);
  }
}

module.exports = {
  createAuditLog,
};