const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const db = require("../db");

const {
  authenticateToken,
  requireRole,
} = require("../middleware/auth");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;

/*
  Generate safe random filename
*/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },

  filename: (req, file, cb) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const randomName =
      crypto.randomBytes(16).toString("hex") +
      extension;

    cb(null, randomName);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },

  fileFilter: (req, file, cb) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return cb(
        new Error(
          "Invalid file type. Allowed: PDF, Word, Excel, PowerPoint and TXT."
        )
      );
    }

    cb(null, true);
  },
});

/*
  Safe original filename
*/
function safeFileName(name) {
  return path
    .basename(String(name || ""))
    .slice(0, 255);
}

/*
  Get extension/type
*/
function getDocumentType(filename) {
  const extension = path
    .extname(filename)
    .toLowerCase();

  return extension.replace(".", "");
}

/*
  Safely resolve stored file
*/
function getSafeFilePath(filePath) {
  if (!filePath) {
    return null;
  }

  const filename = path.basename(
    String(filePath).replace(/\\/g, "/")
  );

  const uploadRoot = path.resolve(UPLOAD_DIR);

  const resolvedPath = path.resolve(
    UPLOAD_DIR,
    filename
  );

  if (
    resolvedPath !== uploadRoot &&
    !resolvedPath.startsWith(
      uploadRoot + path.sep
    )
  ) {
    return null;
  }

  return resolvedPath;
}

/*
  =====================================================
  GET ALL DOCUMENTS
  =====================================================
*/
router.get(
  "/",
  authenticateToken,
  async (req, res) => {
    try {
      const [rows] = await db.query(`
        SELECT
          d.id,
          d.title,
          d.file_name,
          d.file_path,
          d.document_type,
          d.uploaded_by,
          d.uploaded_at,
          u.name AS uploader_name
        FROM documents d
        LEFT JOIN users u
          ON d.uploaded_by = u.id
        ORDER BY d.uploaded_at DESC
      `);

      res.json({
        success: true,
        documents: rows,
      });
    } catch (error) {
      console.error(
        "Get documents error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Failed to fetch documents.",
      });
    }
  }
);

/*
  =====================================================
  SECURE DOCUMENT DOWNLOAD
  =====================================================
*/
router.get(
  "/:id/download",
  authenticateToken,
  async (req, res) => {
    try {
      const documentId = Number(req.params.id);

      if (
        !Number.isInteger(documentId) ||
        documentId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid document ID.",
        });
      }

      const [rows] = await db.query(
        `
        SELECT
          id,
          title,
          file_name,
          file_path,
          document_type
        FROM documents
        WHERE id = ?
        LIMIT 1
        `,
        [documentId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Document not found.",
        });
      }

      const document = rows[0];

      const safePath = getSafeFilePath(
        document.file_path
      );

      if (!safePath) {
        return res.status(400).json({
          success: false,
          message: "Invalid stored file path.",
        });
      }

      if (!fs.existsSync(safePath)) {
        return res.status(404).json({
          success: false,
          message: "File is missing from storage.",
        });
      }

      /*
        Determine MIME type.
      */
      const mimeTypes = {
        pdf: "application/pdf",
        txt: "text/plain",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ppt: "application/vnd.ms-powerpoint",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      };

      const extension = String(
        document.document_type || ""
      ).toLowerCase();

      const contentType =
        mimeTypes[extension] ||
        "application/octet-stream";

      res.setHeader(
        "Content-Type",
        contentType
      );

      res.setHeader(
        "Content-Disposition",
        `inline; filename="${safeFileName(
          document.file_name
        )}"`
      );

      res.setHeader(
        "X-Content-Type-Options",
        "nosniff"
      );

      return res.sendFile(safePath);
    } catch (error) {
      console.error(
        "Document download error:",
        error.message
      );

      res.status(500).json({
        success: false,
        message: "Failed to open document.",
      });
    }
  }
);

/*
  =====================================================
  UPLOAD DOCUMENT
  =====================================================
*/
router.post(
  "/upload",
  authenticateToken,
  requireRole("Admin", "Member"),
  (req, res) => {
    upload.single("file")(
      req,
      res,
      async (error) => {
        if (error instanceof multer.MulterError) {
          if (
            error.code === "LIMIT_FILE_SIZE"
          ) {
            return res.status(400).json({
              success: false,
              message:
                "File size must not exceed 10 MB.",
            });
          }

          return res.status(400).json({
            success: false,
            message: "File upload failed.",
          });
        }

        if (error) {
          return res.status(400).json({
            success: false,
            message:
              error.message ||
              "Invalid file.",
          });
        }

        if (!req.file) {
          return res.status(400).json({
            success: false,
            message:
              "Please select a file.",
          });
        }

        try {
          const title =
            typeof req.body.title === "string"
              ? req.body.title
                  .trim()
                  .slice(0, 200)
              : "";

          if (!title) {
            fs.unlinkSync(req.file.path);

            return res.status(400).json({
              success: false,
              message:
                "Document title is required.",
            });
          }

          const originalName =
            safeFileName(
              req.file.originalname
            );

          const documentType =
            getDocumentType(
              originalName
            );

          /*
            IMPORTANT:
            User ID comes from JWT,
            NOT from frontend.
          */
          const uploadedBy =
            req.user.id;

          const storedPath =
            `/uploads/${req.file.filename}`;

          await db.query(
            `
            INSERT INTO documents
            (
              title,
              file_name,
              file_path,
              document_type,
              uploaded_by
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
              title,
              originalName,
              storedPath,
              documentType,
              uploadedBy,
            ]
          );

          return res.status(201).json({
            success: true,
            message:
              "Document uploaded successfully.",
          });
        } catch (error) {
          if (
            req.file?.path &&
            fs.existsSync(req.file.path)
          ) {
            fs.unlinkSync(req.file.path);
          }

          console.error(
            "Document upload error:",
            error.message
          );

          return res.status(500).json({
            success: false,
            message:
              "Failed to save document.",
          });
        }
      }
    );
  }
);

/*
  =====================================================
  DELETE DOCUMENT
  =====================================================
*/
router.delete(
  "/:id",
  authenticateToken,
  requireRole("Admin"),
  async (req, res) => {
    try {
      const documentId =
        Number(req.params.id);

      if (
        !Number.isInteger(documentId) ||
        documentId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid document ID.",
        });
      }

      const [rows] = await db.query(
        `
        SELECT file_path
        FROM documents
        WHERE id = ?
        LIMIT 1
        `,
        [documentId]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Document not found.",
        });
      }

      const safePath =
        getSafeFilePath(
          rows[0].file_path
        );

      if (
        safePath &&
        fs.existsSync(safePath)
      ) {
        fs.unlinkSync(safePath);
      }

      await db.query(
        `
        DELETE FROM documents
        WHERE id = ?
        `,
        [documentId]
      );

      return res.json({
        success: true,
        message:
          "Document deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Document delete error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete document.",
      });
    }
  }
);

module.exports = router;