require("dotenv").config();

const bcrypt = require("bcryptjs");
const db = require("./db");

async function migratePasswords() {
  try {
    const [users] = await db.query(
      "SELECT id, password FROM users"
    );

    let migrated = 0;

    for (const user of users) {
      // Already bcrypt-hashed password ko skip karo
      if (
        typeof user.password === "string" &&
        /^\$2[aby]\$\d{2}\$/.test(user.password)
      ) {
        continue;
      }

      const hashedPassword = await bcrypt.hash(user.password, 12);

      await db.query(
        "UPDATE users SET password = ? WHERE id = ?",
        [hashedPassword, user.id]
      );

      migrated++;
    }

    console.log(`Password migration completed. ${migrated} account(s) migrated.`);
  } catch (error) {
    console.error("Password migration failed:", error.message);
  } finally {
    await db.end();
  }
}

migratePasswords();