const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

function cleanEmail(value) {
  return typeof value === "string"
    ? value.trim().toLowerCase()
    : "";
}

function cleanName(value) {
  return typeof value === "string"
    ? value.trim().slice(0, 100)
    : "";
}

function createToken(user) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign(
    {
      id: user.id,
      tokenVersion: user.token_version,
    },
    JWT_SECRET,
    {
      expiresIn: "8h",
      issuer: "eventra-api",
    }
  );
}

/* =========================
   REGISTER
========================= */

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    const cleanUserName = cleanName(name);
    const cleanUserEmail = cleanEmail(email);

    if (
      !cleanUserName ||
      !cleanUserEmail ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }

    if (cleanUserName.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Name must be at least 2 characters.",
      });
    }

    if (cleanUserEmail.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Email is too long.",
      });
    }

    if (
      password.length < 8 ||
      password.length > 128
    ) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 8 and 128 characters.",
      });
    }

    /*
      SECURITY:
      Public registration can create Member accounts only.
      Role from request body is deliberately ignored.
      Every new account starts as Pending.
    */

    const accountRole = "Member";

    const [existingUsers] = await db.query(
      `SELECT id
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [cleanUserEmail]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await db.query(
      `INSERT INTO users
       (name, email, password, role, account_status, token_version)
       VALUES (?, ?, ?, ?, 'Pending', 0)`,
      [
        cleanUserName,
        cleanUserEmail,
        passwordHash,
        accountRole,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Account created. Waiting for Admin approval.",
      user: {
        id: result.insertId,
        name: cleanUserName,
        email: cleanUserEmail,
        role: accountRole,
        account_status: "Pending",
      },
    });
  } catch (error) {
    console.error("Register error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create account.",
    });
  }
});

/* =========================
   LOGIN
========================= */

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const cleanUserEmail = cleanEmail(email);

    if (
      !cleanUserEmail ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const [users] = await db.query(
      `SELECT
         id,
         name,
         email,
         password,
         role,
         account_status,
         token_version
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [cleanUserEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const user = users[0];

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (user.account_status === "Pending") {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_PENDING",
        message: "Your account is waiting for Admin approval.",
      });
    }

    if (user.account_status !== "Approved") {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_BLOCKED",
        message: "Your account is not allowed to access the system.",
      });
    }

    const token = createToken(user);

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        account_status: user.account_status,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to process login.",
    });
  }
});

module.exports = router;