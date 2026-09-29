const jwt = require("jsonwebtoken");
const db = require("../db");

const JWT_SECRET = process.env.JWT_SECRET;

/*
  Verify JWT and check current account status from database.
  The database is the source of truth for role and access.
*/

async function authenticateToken(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: "Authentication service is not configured.",
    });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const token = authHeader.substring(7).trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, JWT_SECRET, {
      issuer: "eventra-api",
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }

  if (
    !Number.isInteger(decoded.id) ||
    !Number.isInteger(decoded.tokenVersion)
  ) {
    return res.status(401).json({
      success: false,
      message: "Invalid authentication token.",
    });
  }

  try {
    const [users] = await db.query(
      `SELECT
         id,
         name,
         email,
         role,
         account_status,
         token_version
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    const user = users[0];

    if (user.account_status !== "Approved") {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_NOT_APPROVED",
        message: "Your account is not approved for access.",
      });
    }

    if (user.token_version !== decoded.tokenVersion) {
      return res.status(401).json({
        success: false,
        code: "SESSION_REVOKED",
        message: "Your session is no longer valid. Please log in again.",
      });
    }

    /*
      Always use current database role.
      Never trust a role supplied by the frontend or stale JWT.
    */

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    return next();
  } catch (error) {
    console.error("Authentication database error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to verify account access.",
    });
  }
}

/*
  Server-side Role Based Access Control
*/

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
    }

    return next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
};