import { useEffect, useState } from "react";
import "./Meetings.css";
import { getPermissions } from "./permissions";

const API_URL = "http://localhost:5000";

function getAuthHeaders(extraHeaders = {}) {
  const token = sessionStorage.getItem("smartInstitutionToken");

  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    throw new Error("Session expired. Please logout and login again.");
  }

  if (response.status === 403) {
    throw new Error("You do not have permission to perform this action.");
  }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

function Meetings({ user, onBack }) {
  const permissions = getPermissions(user?.role);

  const canCreate = permissions.meetings.create;
  const canEdit = permissions.meetings.edit;
  const canDelete = permissions.meetings.delete;

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    title: "",
    meeting_date: "",
    meeting_time: "",
    location: "",
    agenda: "",
  });

  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [recordingFile, setRecordingFile] = useState(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptMessage, setTranscriptMessage] = useState("");
  const [transcript, setTranscript] = useState([]);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/api/meetings`, {
        headers: getAuthHeaders(),
      });

      const data = await readResponse(response);
      setMeetings(data.data || []);
    } catch (err) {
      console.error("Meetings error:", err);
      setError(err.message || "Unable to load meetings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const resetForm = () => {
    setForm({
      title: "",
      meeting_date: "",
      meeting_time: "",
      location: "",
      agenda: "",
    });

    setEditingId(null);
    setFormMessage("");
  };

  const openCreateForm = () => {
    if (!canCreate) {
      setError("You do not have permission to create meetings.");
      return;
    }

    setError("");
    resetForm();
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;

    resetForm();
    setShowForm(false);
  };

  const handleSaveMeeting = async (event) => {
    event.preventDefault();

    const isEditing = editingId !== null;

    if (!isEditing && !canCreate) {
      setFormMessage("You do not have permission to create meetings.");
      return;
    }

    if (isEditing && !canEdit) {
      setFormMessage("You do not have permission to edit meetings.");
      return;
    }

    if (!form.title.trim()) {
      setFormMessage("Meeting title is required.");
      return;
    }

    if (!form.meeting_date || !form.meeting_time) {
      setFormMessage("Meeting date and time are required.");
      return;
    }

    try {
      setSaving(true);
      setFormMessage("");

      const url = isEditing
        ? `${API_URL}/api/meetings/${editingId}`
        : `${API_URL}/api/meetings`;

      const response = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          title: form.title.trim(),
          meeting_date: form.meeting_date,
          meeting_time: form.meeting_time,
          location: form.location.trim(),
          agenda: form.agenda.trim(),
        }),
      });

      await readResponse(response);

      setFormMessage(
        isEditing
          ? "Meeting updated successfully."
          : "Meeting created successfully."
      );

      await fetchMeetings();

      resetForm();
      setShowForm(false);
    } catch (err) {
      console.error("Save meeting error:", err);
      setFormMessage(err.message || "Unable to save meeting.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (meeting) => {
    if (!canEdit) {
      setError("You do not have permission to edit meetings.");
      return;
    }

    setError("");
    setEditingId(meeting.id);

    setForm({
      title: meeting.title || "",
      meeting_date: meeting.meeting_date
        ? String(meeting.meeting_date).slice(0, 10)
        : "",
      meeting_time: meeting.meeting_time
        ? String(meeting.meeting_time).slice(0, 5)
        : "",
      location: meeting.location || "",
      agenda: meeting.agenda || "",
    });

    setFormMessage("");
    setShowForm(true);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeTranscriptPanel = () => {
    if (transcriptLoading) return;

    setSelectedMeeting(null);
    setRecordingFile(null);
    setTranscript([]);
    setTranscriptMessage("");
  };

  const handleDelete = async (meetingId) => {
    if (!canDelete) {
      setError("You do not have permission to delete meetings.");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this meeting?")) {
      return;
    }

    try {
      setError("");

      const response = await fetch(
        `${API_URL}/api/meetings/${meetingId}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      await readResponse(response);

      if (selectedMeeting?.id === meetingId) {
        closeTranscriptPanel();
      }

      await fetchMeetings();
    } catch (err) {
      console.error("Delete meeting error:", err);
      setError(err.message || "Unable to delete meeting.");
    }
  };

  const handleRecordingChange = (event) => {
    const file = event.target.files?.[0];

    setTranscriptMessage("");
    setTranscript([]);

    if (!file) {
      setRecordingFile(null);
      return;
    }

    const allowedExtensions = /\.(mp3|wav|m4a|mp4|webm|mov)$/i;
    const maxSize = 100 * 1024 * 1024;

    if (!allowedExtensions.test(file.name)) {
      setRecordingFile(null);
      setTranscriptMessage("Please select a supported audio or video file.");
      return;
    }

    if (file.size > maxSize) {
      setRecordingFile(null);
      setTranscriptMessage("Recording must be smaller than 100 MB.");
      return;
    }

    setRecordingFile(file);
  };

  const loadSavedTranscript = async (meetingId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/meetings/${meetingId}/transcript`,
        {
          headers: getAuthHeaders(),
        }
      );

      const data = await readResponse(response);

      setTranscript(
        Array.isArray(data.transcript) ? data.transcript : []
      );
    } catch (err) {
      console.error("Load transcript error:", err);
      setTranscript([]);
      setTranscriptMessage(err.message || "Unable to load saved transcript.");
    }
  };

  const openTranscriptPanel = async (meeting) => {
    setSelectedMeeting(meeting);
    setRecordingFile(null);
    setTranscript([]);
    setTranscriptMessage("");

    await loadSavedTranscript(meeting.id);
  };

  const saveTranscript = async (meetingId, transcriptData) => {
    const response = await fetch(
      `${API_URL}/api/meetings/${meetingId}/transcript/save`,
      {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          transcript: transcriptData,
        }),
      }
    );

    return readResponse(response);
  };

  const handleGenerateTranscript = async () => {
    if (!selectedMeeting) {
      setTranscriptMessage("Please select a meeting first.");
      return;
    }

    if (!recordingFile) {
      setTranscriptMessage("Please select an audio or video recording.");
      return;
    }

    try {
      setTranscriptLoading(true);
      setTranscriptMessage("");
      setTranscript([]);

      const formData = new FormData();
      formData.append("recording", recordingFile);
      formData.append("meeting_id", String(selectedMeeting.id));

      const response = await fetch(
        `${API_URL}/api/meetings/${selectedMeeting.id}/transcript`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: formData,
        }
      );

      const data = await readResponse(response);

      const generatedTranscript = Array.isArray(data.transcript)
        ? data.transcript
        : [];

      if (generatedTranscript.length === 0) {
        throw new Error("No transcript was generated from this recording.");
      }

      setTranscript(generatedTranscript);

      await saveTranscript(
        selectedMeeting.id,
        generatedTranscript
      );

      setTranscriptMessage("Transcript generated and saved successfully.");
    } catch (err) {
      console.error("Transcript error:", err);
      setTranscriptMessage(err.message || "Unable to generate transcript.");
    } finally {
      setTranscriptLoading(false);
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return "—";

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
      return String(dateValue);
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (timeValue) => {
    if (!timeValue) return "—";

    const parts = String(timeValue).split(":");
    if (parts.length < 2) return String(timeValue);

    const hours = Number(parts[0]);
    const minutes = parts[1];

    if (Number.isNaN(hours)) return String(timeValue);

    const suffix = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;

    return `${displayHour}:${minutes} ${suffix}`;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingMeetings = meetings.filter((meeting) => {
    if (!meeting.meeting_date) return false;

    const date = new Date(meeting.meeting_date);
    date.setHours(0, 0, 0, 0);

    return date >= today;
  }).length;

  const completedMeetings = meetings.length - upcomingMeetings;

  return (
    <div className="meetings-page">
      <div className="meetings-header">
        <button
          type="button"
          className="meetings-back-btn"
          onClick={onBack}
        >
          ← Dashboard
        </button>

        <div className="meetings-title-block">
          <p className="meetings-eyebrow">EVENTRA / MEETINGS</p>
          <h1>Meetings</h1>
          <p className="meetings-subtitle">
            Centralized meeting records, agendas and minutes.
          </p>
        </div>

        <div className="meetings-header-actions">
          <button
            type="button"
            className="refresh-btn"
            onClick={fetchMeetings}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "↻ Refresh"}
          </button>

          {canCreate && (
            <button
              type="button"
              className="create-meeting-btn"
              onClick={openCreateForm}
            >
              + Create Meeting
            </button>
          )}
        </div>
      </div>

      {error && <div className="meetings-error">{error}</div>}

      {showForm && (
        <div className="meeting-form-card">
          <div className="meeting-form-header">
            <div>
              <p className="meetings-eyebrow">
                {editingId ? "EDIT RECORD" : "NEW RECORD"}
              </p>
              <h2>{editingId ? "Edit Meeting" : "Create Meeting"}</h2>
              <p>
                {editingId
                  ? "Update the meeting information below."
                  : "Add a new meeting to the institutional record."}
              </p>
            </div>

            <button
              type="button"
              className="form-close-btn"
              onClick={closeForm}
              disabled={saving}
            >
              ×
            </button>
          </div>

          <form className="meeting-form" onSubmit={handleSaveMeeting}>
            <div className="form-grid">
              <div className="form-field full-width">
                <label htmlFor="title">Meeting Title *</label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Enter meeting title"
                  maxLength={200}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="meeting_date">Date *</label>
                <input
                  id="meeting_date"
                  name="meeting_date"
                  type="date"
                  value={form.meeting_date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field">
                <label htmlFor="meeting_time">Time *</label>
                <input
                  id="meeting_time"
                  name="meeting_time"
                  type="time"
                  value={form.meeting_time}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-field full-width">
                <label htmlFor="location">Location</label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  value={form.location}
                  onChange={handleChange}
                  placeholder="e.g. Conference Hall"
                  maxLength={200}
                />
              </div>

              <div className="form-field full-width">
                <label htmlFor="agenda">Agenda</label>
                <textarea
                  id="agenda"
                  name="agenda"
                  value={form.agenda}
                  onChange={handleChange}
                  placeholder="Enter meeting agenda..."
                  maxLength={5000}
                />
              </div>
            </div>

            {formMessage && (
              <div className="form-message">{formMessage}</div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="save-meeting-btn"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Meeting"
                    : "Save Meeting"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="meetings-summary">
        <div className="summary-card">
          <span>Total Meetings</span>
          <strong>{meetings.length}</strong>
        </div>

        <div className="summary-card">
          <span>Upcoming</span>
          <strong>{upcomingMeetings}</strong>
        </div>

        <div className="summary-card">
          <span>Completed</span>
          <strong>{completedMeetings}</strong>
        </div>
      </div>

      <div className="meetings-card">
        <div className="card-heading">
          <div>
            <h2>Meeting Records</h2>
            <p>All meetings stored in the institutional system.</p>
          </div>
        </div>

        {loading ? (
          <div className="meetings-loading">
            <div className="loading-spinner"></div>
            <span>Loading meetings...</span>
          </div>
        ) : meetings.length === 0 ? (
          <div className="empty-meetings">
            <div className="empty-icon">📅</div>
            <h3>No meetings yet</h3>
            <p>Create your first meeting record to get started.</p>
          </div>
        ) : (
          <div className="meeting-list">
            {meetings.map((meeting) => {
              const meetingDate = new Date(meeting.meeting_date);
              meetingDate.setHours(0, 0, 0, 0);

              const isUpcoming = meetingDate >= today;

              return (
                <div className="meeting-row" key={meeting.id}>
                  <div className="meeting-main">
                    <div className="meeting-icon">📅</div>

                    <div>
                      <h3>{meeting.title}</h3>

                      <div className="meeting-meta">
                        <span>📆 {formatDate(meeting.meeting_date)}</span>
                        <span>🕐 {formatTime(meeting.meeting_time)}</span>

                        {meeting.location && (
                          <span>📍 {meeting.location}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="meeting-agenda">
                    <span>AGENDA</span>
                    <p>{meeting.agenda || "No agenda provided."}</p>
                  </div>

                  <div className="meeting-actions">
                    <span
                      className={`status-badge ${
                        isUpcoming ? "available" : "pending"
                      }`}
                    >
                      {isUpcoming ? "Upcoming" : "Completed"}
                    </span>

                    <button
                      type="button"
                      className="meeting-action-btn transcript-btn"
                      onClick={() => openTranscriptPanel(meeting)}
                    >
                      🎙 Transcript
                    </button>

                    {canEdit && (
                      <button
                        type="button"
                        className="meeting-action-btn edit-btn"
                        onClick={() => handleEdit(meeting)}
                      >
                        Edit
                      </button>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        className="meeting-action-btn delete-btn"
                        onClick={() => handleDelete(meeting.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedMeeting && (
        <div className="transcript-overlay">
          <div className="transcript-panel">
            <div className="transcript-header">
              <div>
                <p className="meetings-eyebrow">
                  EVENTRA / TRANSCRIPTION
                </p>
                <h2>{selectedMeeting.title}</h2>
                <p>
                  Upload the meeting audio or video to generate a
                  speaker-wise transcript.
                </p>
              </div>

              <button
                type="button"
                className="form-close-btn"
                onClick={closeTranscriptPanel}
                disabled={transcriptLoading}
              >
                ×
              </button>
            </div>

            <div className="transcript-upload-card">
              <div className="transcript-upload-icon">🎙</div>

              <div>
                <h3>Meeting Recording</h3>
                <p>Supported: MP3, WAV, M4A, MP4, WebM and MOV</p>
                <p>Maximum size: 100 MB</p>
              </div>

              <label className="transcript-file-label">
                Choose Audio / Video
                <input
                  type="file"
                  accept=".mp3,.wav,.m4a,.mp4,.webm,.mov,audio/*,video/*"
                  onChange={handleRecordingChange}
                  disabled={transcriptLoading}
                />
              </label>

              {recordingFile && (
                <div className="selected-recording">
                  <strong>{recordingFile.name}</strong>
                  <span>
                    {(recordingFile.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
              )}

              <button
                type="button"
                className="generate-transcript-btn"
                onClick={handleGenerateTranscript}
                disabled={transcriptLoading || !recordingFile}
              >
                {transcriptLoading
                  ? "Processing Recording..."
                  : "Generate Transcript"}
              </button>
            </div>

            {transcriptMessage && (
              <div className="transcript-message">
                {transcriptMessage}
              </div>
            )}

            <div className="transcript-result">
              <div className="transcript-result-header">
                <div>
                  <h3>Transcript</h3>
                  <p>
                    Speaker identification and timestamps will appear here.
                  </p>
                </div>
              </div>

              {transcriptLoading ? (
                <div className="transcript-processing">
                  <div className="loading-spinner"></div>
                  <strong>Processing recording...</strong>
                  <span>
                    Extracting speech and identifying speakers.
                  </span>
                </div>
              ) : transcript.length === 0 ? (
                <div className="transcript-empty">
                  <div>📝</div>
                  <h4>No transcript generated yet</h4>
                  <p>
                    Upload a meeting recording and click Generate Transcript.
                  </p>
                </div>
              ) : (
                <div className="transcript-list">
                  {transcript.map((line, index) => (
                    <div
                      className="transcript-line"
                      key={line.id || `${line.start}-${index}`}
                    >
                      <div className="transcript-time">
                        {line.start ?? "00:00"}
                      </div>

                      <div className="transcript-speaker">
                        {line.speaker || `Speaker ${index + 1}`}
                      </div>

                      <div className="transcript-text">
                        {line.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="meetings-footer">
        Logged in as <strong>{user?.name || "User"}</strong>
        {" "}·{" "}
        {user?.role || "Member"}
      </div>
    </div>
  );
}

export default Meetings;