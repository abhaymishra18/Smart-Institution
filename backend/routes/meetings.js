const express = require("express");
const db = require("../db");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const {
  authenticateToken,
  requireRole,
} = require("../middleware/auth");

const {
  createAuditLog,
} = require("../utils/auditLog");

const router = express.Router();

/* =====================================================
   BASIC HELPERS
===================================================== */

function getValidMeetingId(value) {
  const id = Number(value);

  return Number.isInteger(id) && id > 0
    ? id
    : null;
}

function cleanText(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const text = String(value).trim();

  return text === "" ? null : text;
}

function validateMeetingInput(body) {
  const title = String(
    body.title || ""
  ).trim();

  const meeting_date = String(
    body.meeting_date || ""
  ).trim();

  const meeting_time = String(
    body.meeting_time || ""
  ).trim();

  if (
    !title ||
    !meeting_date ||
    !meeting_time
  ) {
    return {
      valid: false,
      message:
        "Title, meeting date and meeting time are required.",
    };
  }

  if (
    title.length < 3 ||
    title.length > 200
  ) {
    return {
      valid: false,
      message:
        "Meeting title must be between 3 and 200 characters.",
    };
  }

  return {
    valid: true,

    data: {
      title,
      meeting_date,
      meeting_time,
      location: cleanText(
        body.location
      ),
      agenda: cleanText(
        body.agenda
      ),
      minutes: cleanText(
        body.minutes
      ),
    },
  };
}

/* =====================================================
   TRANSCRIPT CONFIGURATION
===================================================== */

const TEMP_MEETINGS_DIR = path.join(
  __dirname,
  "..",
  "temp-meetings"
);

const PROCESS_SCRIPT = path.join(
  __dirname,
  "..",
  "process_meeting.py"
);

const PYTHON_PATH = path.join(
  __dirname,
  "..",
  ".venv",
  "Scripts",
  "python.exe"
);

const FFMPEG_COMMAND = "ffmpeg";

const ALLOWED_EXTENSIONS =
  new Set([
    ".mp3",
    ".wav",
    ".m4a",
    ".mp4",
    ".webm",
    ".mov",
  ]);

const ALLOWED_MIME_TYPES =
  new Set([
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/mp4",
    "audio/x-m4a",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "application/octet-stream",
  ]);

const MAX_RECORDING_SIZE =
  100 * 1024 * 1024;

/* =====================================================
   TEMP DIRECTORY
===================================================== */

if (
  !fs.existsSync(
    TEMP_MEETINGS_DIR
  )
) {
  fs.mkdirSync(
    TEMP_MEETINGS_DIR,
    {
      recursive: true,
    }
  );
}

/* =====================================================
   MULTER STORAGE
===================================================== */

const recordingStorage =
  multer.diskStorage({
    destination: (
      req,
      file,
      cb
    ) => {
      cb(
        null,
        TEMP_MEETINGS_DIR
      );
    },

    filename: (
      req,
      file,
      cb
    ) => {
      const extension =
        path
          .extname(
            file.originalname
          )
          .toLowerCase();

      const randomName =
        crypto
          .randomBytes(16)
          .toString("hex") +
        extension;

      cb(
        null,
        randomName
      );
    },
  });

/* =====================================================
   MULTER FILTER
===================================================== */

const recordingUpload =
  multer({
    storage:
      recordingStorage,

    limits: {
      fileSize:
        MAX_RECORDING_SIZE,
      files: 1,
    },

    fileFilter: (
      req,
      file,
      cb
    ) => {
      const extension =
        path
          .extname(
            file.originalname
          )
          .toLowerCase();

      const mimeType =
        String(
          file.mimetype || ""
        ).toLowerCase();

      if (
        !ALLOWED_EXTENSIONS.has(
          extension
        )
      ) {
        return cb(
          new Error(
            "Unsupported recording format."
          )
        );
      }

      if (
        mimeType &&
        !ALLOWED_MIME_TYPES.has(
          mimeType
        )
      ) {
        return cb(
          new Error(
            "Unsupported recording MIME type."
          )
        );
      }

      cb(null, true);
    },
  });

/* =====================================================
   SAFE FILE DELETE
===================================================== */

function deleteFileSafely(
  filePath
) {
  if (!filePath) {
    return;
  }

  try {
    if (
      fs.existsSync(filePath)
    ) {
      fs.unlinkSync(
        filePath
      );
    }
  } catch (error) {
    console.error(
      "TEMP FILE DELETE ERROR:",
      error.message
    );
  }
}

/* =====================================================
   CONVERT TO WAV
===================================================== */

function convertToWav(
  inputFile,
  outputFile
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      const ffmpeg =
        spawn(
          FFMPEG_COMMAND,
          [
            "-y",
            "-i",
            inputFile,
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            outputFile,
          ],
          {
            windowsHide:
              true,
          }
        );

      let stderr = "";

      ffmpeg.stderr.on(
        "data",
        (data) => {
          stderr +=
            data.toString();
        }
      );

      ffmpeg.on(
        "error",
        reject
      );

      ffmpeg.on(
        "close",
        (code) => {
          if (code !== 0) {
            return reject(
              new Error(
                `FFmpeg failed with code ${code}: ${stderr.slice(
                  -2000
                )}`
              )
            );
          }

          if (
            !fs.existsSync(
              outputFile
            )
          ) {
            return reject(
              new Error(
                "FFmpeg did not create the WAV file."
              )
            );
          }

          resolve();
        }
      );
    }
  );
}

/* =====================================================
   RUN PYTHON PROCESSOR
===================================================== */

function runMeetingProcessor(
  wavFile
) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      if (
        !fs.existsSync(
          PYTHON_PATH
        )
      ) {
        return reject(
          new Error(
            "Python virtual environment was not found."
          )
        );
      }

      if (
        !fs.existsSync(
          PROCESS_SCRIPT
        )
      ) {
        return reject(
          new Error(
            "process_meeting.py was not found."
          )
        );
      }

      const pythonProcess =
        spawn(
          PYTHON_PATH,
          [
            "-u",
            PROCESS_SCRIPT,
            wavFile,
          ],
          {
            cwd: path.join(
              __dirname,
              ".."
            ),

            env: {
              ...process.env,
            },

            windowsHide:
              true,
          }
        );

      let stdout = "";
      let stderr = "";

      pythonProcess.stdout.on(
        "data",
        (data) => {
          stdout +=
            data.toString();
        }
      );

      pythonProcess.stderr.on(
        "data",
        (data) => {
          stderr +=
            data.toString();
        }
      );

      pythonProcess.on(
        "error",
        reject
      );

      pythonProcess.on(
        "close",
        (code) => {
          if (code !== 0) {
            console.error(
              "PYTHON PROCESS ERROR:",
              stderr.slice(-4000)
            );

            return reject(
              new Error(
                "Meeting transcription process failed."
              )
            );
          }

          const startMarker =
            "===JSON_RESULT_START===";

          const endMarker =
            "===JSON_RESULT_END===";

          const startIndex =
            stdout.indexOf(
              startMarker
            );

          const endIndex =
            stdout.indexOf(
              endMarker
            );

          if (
            startIndex === -1 ||
            endIndex === -1 ||
            endIndex <= startIndex
          ) {
            console.error(
              "PYTHON OUTPUT:",
              stdout.slice(-4000)
            );

            return reject(
              new Error(
                "Transcript JSON result was not found."
              )
            );
          }

          const jsonText =
            stdout
              .slice(
                startIndex +
                  startMarker.length,
                endIndex
              )
              .trim();

          try {
            const result =
              JSON.parse(
                jsonText
              );

            if (
              Array.isArray(
                result
              )
            ) {
              return resolve(
                result
              );
            }

            if (
              result &&
              Array.isArray(
                result.transcript
              )
            ) {
              return resolve(
                result.transcript
              );
            }

            return reject(
              new Error(
                "Invalid transcript result."
              )
            );
          } catch (error) {
            console.error(
              "TRANSCRIPT JSON PARSE ERROR:",
              error.message
            );

            reject(
              new Error(
                "Unable to parse transcript result."
              )
            );
          }
        }
      );
    }
  );
}

/* =====================================================
   GET ALL MEETINGS
   AUTHENTICATED: ALL ROLES
===================================================== */

router.get(
  "/",
  authenticateToken,
  async (
    req,
    res
  ) => {
    try {
      const [meetings] =
        await db.query(`
          SELECT
            id,
            title,
            meeting_date,
            meeting_time,
            location,
            agenda,
            minutes,
            created_by,
            created_at
          FROM meetings
          ORDER BY
            meeting_date DESC,
            meeting_time DESC,
            id DESC
        `);

      res.json({
        success: true,
        data: meetings,
      });
    } catch (error) {
      console.error(
        "GET MEETINGS ERROR:",
        error.message
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to load meetings.",
      });
    }
  }
);

/* =====================================================
   GET SINGLE MEETING
   AUTHENTICATED: ALL ROLES
===================================================== */

router.get(
  "/:id",
  authenticateToken,
  async (
    req,
    res
  ) => {
    try {
      const meetingId =
        getValidMeetingId(
          req.params.id
        );

      if (!meetingId) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid meeting ID.",
        });
      }

      const [meetings] =
        await db.query(
          `
          SELECT
            id,
            title,
            meeting_date,
            meeting_time,
            location,
            agenda,
            minutes,
            created_by,
            created_at
          FROM meetings
          WHERE id = ?
          LIMIT 1
          `,
          [meetingId]
        );

      if (
        meetings.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Meeting not found.",
        });
      }

      res.json({
        success: true,
        data: meetings[0],
      });
    } catch (error) {
      console.error(
        "GET SINGLE MEETING ERROR:",
        error.message
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to load meeting.",
      });
    }
  }
);

/* =====================================================
   CREATE MEETING
   ADMIN + MEMBER
===================================================== */

router.post(
  "/",
  authenticateToken,
  requireRole(
    "Admin",
    "Member"
  ),
  async (
    req,
    res
  ) => {
    try {
      const validation =
        validateMeetingInput(
          req.body
        );

      if (
        !validation.valid
      ) {
        return res.status(400).json({
          success: false,
          message:
            validation.message,
        });
      }

      const {
        title,
        meeting_date,
        meeting_time,
        location,
        agenda,
        minutes,
      } = validation.data;

      /*
        SECURITY:
        User identity comes from
        verified JWT.
      */
      const createdBy =
        req.user.id;

      const [result] =
        await db.query(
          `
          INSERT INTO meetings
          (
            title,
            meeting_date,
            meeting_time,
            location,
            agenda,
            minutes,
            created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            title,
            meeting_date,
            meeting_time,
            location,
            agenda,
            minutes,
            createdBy,
          ]
        );

      const meetingId =
        result.insertId;

      /* ===============================
         AUDIT LOG
      =============================== */

      await createAuditLog({
        req,
        action: "CREATE",
        module: "Meetings",
        recordId: meetingId,
        description:
          `Created meeting "${title}"`,
      });

      res.status(201).json({
        success: true,
        message:
          "Meeting created successfully.",

        data: {
          id: meetingId,
          title,
          meeting_date,
          meeting_time,
          location,
          agenda,
          minutes,
          created_by:
            createdBy,
        },
      });
    } catch (error) {
      console.error(
        "CREATE MEETING ERROR:",
        error.message
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to create meeting.",
      });
    }
  }
);

/* =====================================================
   UPDATE MEETING
   ADMIN + MEMBER
===================================================== */

router.put(
  "/:id",
  authenticateToken,
  requireRole(
    "Admin",
    "Member"
  ),
  async (
    req,
    res
  ) => {
    try {
      const meetingId =
        getValidMeetingId(
          req.params.id
        );

      if (!meetingId) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid meeting ID.",
        });
      }

      const validation =
        validateMeetingInput(
          req.body
        );

      if (
        !validation.valid
      ) {
        return res.status(400).json({
          success: false,
          message:
            validation.message,
        });
      }

      const {
        title,
        meeting_date,
        meeting_time,
        location,
        agenda,
        minutes,
      } = validation.data;

      /* Get old record for audit description */
      const [existingRows] =
        await db.query(
          `
          SELECT title
          FROM meetings
          WHERE id = ?
          LIMIT 1
          `,
          [meetingId]
        );

      if (
        existingRows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Meeting not found.",
        });
      }

      const [result] =
        await db.query(
          `
          UPDATE meetings
          SET
            title = ?,
            meeting_date = ?,
            meeting_time = ?,
            location = ?,
            agenda = ?,
            minutes = ?
          WHERE id = ?
          `,
          [
            title,
            meeting_date,
            meeting_time,
            location,
            agenda,
            minutes,
            meetingId,
          ]
        );

      if (
        result.affectedRows === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Meeting not found.",
        });
      }

      /* ===============================
         AUDIT LOG
      =============================== */

      await createAuditLog({
        req,
        action: "UPDATE",
        module: "Meetings",
        recordId: meetingId,
        description:
          `Updated meeting "${title}"`,
      });

      res.json({
        success: true,
        message:
          "Meeting updated successfully.",
      });
    } catch (error) {
      console.error(
        "UPDATE MEETING ERROR:",
        error.message
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to update meeting.",
      });
    }
  }
);

/* =====================================================
   DELETE MEETING
   ADMIN ONLY
===================================================== */

router.delete(
  "/:id",
  authenticateToken,
  requireRole("Admin"),
  async (
    req,
    res
  ) => {
    try {
      const meetingId =
        getValidMeetingId(
          req.params.id
        );

      if (!meetingId) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid meeting ID.",
        });
      }

      /*
        Fetch title before deletion
        for audit trail.
      */
      const [meetingRows] =
        await db.query(
          `
          SELECT title
          FROM meetings
          WHERE id = ?
          LIMIT 1
          `,
          [meetingId]
        );

      if (
        meetingRows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Meeting not found.",
        });
      }

      const meetingTitle =
        meetingRows[0].title;

      const [result] =
        await db.query(
          `
          DELETE FROM meetings
          WHERE id = ?
          `,
          [meetingId]
        );

      if (
        result.affectedRows === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Meeting not found.",
        });
      }

      /* ===============================
         AUDIT LOG
      =============================== */

      await createAuditLog({
        req,
        action: "DELETE",
        module: "Meetings",
        recordId: meetingId,
        description:
          `Deleted meeting "${meetingTitle}"`,
      });

      res.json({
        success: true,
        message:
          "Meeting deleted successfully.",
      });
    } catch (error) {
      console.error(
        "DELETE MEETING ERROR:",
        error.message
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to delete meeting.",
      });
    }
  }
);

/* =====================================================
   GENERATE TRANSCRIPT
   ADMIN + MEMBER
===================================================== */

router.post(
  "/:id/transcript",
  authenticateToken,
  requireRole(
    "Admin",
    "Member"
  ),

  (
    req,
    res,
    next
  ) => {
    recordingUpload.single(
      "recording"
    )(
      req,
      res,
      (error) => {
        if (error) {
          console.error(
            "RECORDING UPLOAD ERROR:",
            error.message
          );

          if (
            error instanceof
            multer.MulterError
          ) {
            if (
              error.code ===
              "LIMIT_FILE_SIZE"
            ) {
              return res
                .status(400)
                .json({
                  success: false,
                  message:
                    "Recording is too large. Maximum size is 100 MB.",
                });
            }

            return res
              .status(400)
              .json({
                success: false,
                message:
                  "Recording upload failed.",
              });
          }

          return res
            .status(400)
            .json({
              success: false,
              message:
                error.message,
            });
        }

        next();
      }
    );
  },

  async (
    req,
    res
  ) => {
    let uploadedFile =
      null;

    let wavFile = null;

    try {
      const meetingId =
        getValidMeetingId(
          req.params.id
        );

      if (!meetingId) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid meeting ID.",
        });
      }

      const [meetings] =
        await db.query(
          `
          SELECT
            id,
            title
          FROM meetings
          WHERE id = ?
          LIMIT 1
          `,
          [meetingId]
        );

      if (
        meetings.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Meeting not found.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            "Please upload an audio or video recording.",
        });
      }

      uploadedFile =
        req.file.path;

      if (
        req.body.meeting_id !==
          undefined &&
        req.body.meeting_id !==
          ""
      ) {
        const bodyMeetingId =
          getValidMeetingId(
            req.body.meeting_id
          );

        if (
          bodyMeetingId !==
          meetingId
        ) {
          deleteFileSafely(
            uploadedFile
          );

          uploadedFile =
            null;

          return res
            .status(400)
            .json({
              success: false,
              message:
                "Meeting ID mismatch.",
            });
        }
      }

      const wavName =
        crypto
          .randomBytes(16)
          .toString("hex") +
        ".wav";

      wavFile =
        path.join(
          TEMP_MEETINGS_DIR,
          wavName
        );

      console.log(
        "Converting meeting recording..."
      );

      await convertToWav(
        uploadedFile,
        wavFile
      );

      console.log(
        "Audio conversion completed."
      );

      console.log(
        "Starting meeting transcription..."
      );

      const transcript =
        await runMeetingProcessor(
          wavFile
        );

      console.log(
        "Meeting transcription completed."
      );

      /* ===============================
         AUDIT LOG
      =============================== */

      await createAuditLog({
        req,
        action:
          "TRANSCRIPT_GENERATE",
        module:
          "Meetings",
        recordId:
          meetingId,
        description:
          `Generated transcript for meeting "${meetings[0].title}"`,
      });

      return res.json({
        success: true,
        message:
          "Meeting transcript generated successfully.",
        transcript,
      });
    } catch (error) {
      console.error(
        "TRANSCRIPT ERROR:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to generate meeting transcript.",
      });
    } finally {
      deleteFileSafely(
        uploadedFile
      );

      deleteFileSafely(
        wavFile
      );
    }
  }
);

/* =====================================================
   SAVE TRANSCRIPT
   ADMIN + MEMBER
===================================================== */

router.post(
  "/:id/transcript/save",
  authenticateToken,
  requireRole(
    "Admin",
    "Member"
  ),
  async (
    req,
    res
  ) => {
    try {
      const meetingId =
        getValidMeetingId(
          req.params.id
        );

      if (!meetingId) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid meeting ID.",
        });
      }

      const transcript =
        req.body?.transcript;

      if (
        !Array.isArray(
          transcript
        ) ||
        transcript.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Transcript data is required.",
        });
      }

      if (
        transcript.length >
        5000
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Transcript contains too many segments.",
        });
      }

      const [
        meetingRows,
      ] = await db.query(
        `
        SELECT
          id,
          title
        FROM meetings
        WHERE id = ?
        LIMIT 1
        `,
        [meetingId]
      );

      if (
        meetingRows.length ===
        0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Meeting not found.",
        });
      }

      const connection =
        await db.getConnection();

      try {
        await connection.beginTransaction();

        await connection.query(
          `
          DELETE FROM meeting_transcripts
          WHERE meeting_id = ?
          `,
          [meetingId]
        );

        for (
          const item of transcript
        ) {
          const startTime =
            Number(
              item.start
            );

          const endTime =
            Number(
              item.end
            );

          const speaker =
            String(
              item.speaker ||
                ""
            ).trim();

          const text =
            String(
              item.text ||
                ""
            ).trim();

          if (
            !Number.isFinite(
              startTime
            ) ||
            !Number.isFinite(
              endTime
            ) ||
            startTime < 0 ||
            endTime <
              startTime ||
            !speaker ||
            !text
          ) {
            continue;
          }

          await connection.query(
            `
            INSERT INTO meeting_transcripts
            (
              meeting_id,
              start_time,
              end_time,
              speaker,
              transcript_text
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
              meetingId,
              startTime,
              endTime,
              speaker.slice(
                0,
                100
              ),
              text.slice(
                0,
                10000
              ),
            ]
          );
        }

        await connection.commit();

        /* ===============================
           AUDIT LOG
        =============================== */

        await createAuditLog({
          req,
          action:
            "TRANSCRIPT_SAVE",
          module:
            "Meetings",
          recordId:
            meetingId,
          description:
            `Saved transcript for meeting "${meetingRows[0].title}"`,
        });

        res.json({
          success: true,
          message:
            "Transcript saved successfully.",
        });
      } catch (error) {
        await connection.rollback();

        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error(
        "SAVE TRANSCRIPT ERROR:",
        error.message
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to save transcript.",
      });
    }
  }
);

/* =====================================================
   LOAD TRANSCRIPT
   AUTHENTICATED: ALL ROLES
===================================================== */

router.get(
  "/:id/transcript",
  authenticateToken,
  async (
    req,
    res
  ) => {
    try {
      const meetingId =
        getValidMeetingId(
          req.params.id
        );

      if (!meetingId) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid meeting ID.",
        });
      }

      const [rows] =
        await db.query(
          `
          SELECT
            id,
            start_time AS start,
            end_time AS end,
            speaker,
            transcript_text AS text,
            created_at
          FROM meeting_transcripts
          WHERE meeting_id = ?
          ORDER BY
            start_time ASC,
            id ASC
          `,
          [meetingId]
        );

      res.json({
        success: true,
        transcript: rows,
      });
    } catch (error) {
      console.error(
        "LOAD TRANSCRIPT ERROR:",
        error.message
      );

      res.status(500).json({
        success: false,
        message:
          "Unable to load transcript.",
      });
    }
  }
);

/* =====================================================
   MULTER / ROUTE ERROR HANDLER
===================================================== */

router.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "MEETING ROUTE ERROR:",
      error.message
    );

    if (
      res.headersSent
    ) {
      return next(error);
    }

    res.status(500).json({
      success: false,
      message:
        "Meeting processing failed.",
    });
  }
);

module.exports = router;