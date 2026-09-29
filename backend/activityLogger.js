const db = require("./db");

async function logActivity({
  userId = null,
  userName = "System",
  userRole = "System",
  action,
  module,
  recordId = null,
  description,
}) {
  try {
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
        module,
        recordId,
        description,
      ]
    );
  } catch (error) {
    console.error(
      "Activity log error:",
      error.message
    );
  }
}

module.exports = logActivity;