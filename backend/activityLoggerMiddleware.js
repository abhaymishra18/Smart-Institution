const logActivity = require("./activityLogger");

function getModuleFromPath(path) {
  if (path.includes("/meetings")) return "Meetings";
  if (path.includes("/events")) return "Events";
  if (path.includes("/policies")) return "Policies";
  if (path.includes("/documents")) return "Documents";

  return null;
}

function getAction(method) {
  if (method === "POST") return "Created";
  if (method === "PUT" || method === "PATCH") return "Updated";
  if (method === "DELETE") return "Deleted";

  return null;
}

function activityLoggerMiddleware(req, res, next) {
  const method = req.method;

  // Only track write operations
  const action = getAction(method);

  if (!action) {
    return next();
  }

  const module = getModuleFromPath(req.originalUrl);

  // Ignore unrelated API routes
  if (!module) {
    return next();
  }

  res.on("finish", async () => {
    // Log only successful operations
    if (res.statusCode < 200 || res.statusCode >= 300) {
      return;
    }

    try {
      const userId =
        req.headers["x-user-id"] || null;

      const userRole =
        req.headers["x-user-role"] || "Member";

      const userName =
        req.headers["x-user-name"] || "User";

      const recordId =
        req.params?.id ||
        req.body?.id ||
        null;

      let description = `${action} ${module}`;

      if (recordId) {
        description += ` #${recordId}`;
      }

      await logActivity({
        userId,
        userName,
        userRole,
        action,
        module,
        recordId,
        description,
      });
    } catch (error) {
      console.error(
        "Activity middleware error:",
        error.message
      );
    }
  });

  next();
}

module.exports = activityLoggerMiddleware;