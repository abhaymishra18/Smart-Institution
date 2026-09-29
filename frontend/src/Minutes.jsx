import { useEffect, useState } from "react";
import "./Minutes.css";

const API_URL = "http://localhost:5000";

function Minutes({ user, onBack }) {
  const [meetings, setMeetings] = useState([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState("");

  const [transcript, setTranscript] = useState([]);
  const [minutes, setMinutes] = useState(null);

  const [summary, setSummary] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [decisions, setDecisions] = useState("");
  const [actionItems, setActionItems] = useState("");

  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");

  /* ===============================
     AUTH HEADER
  =============================== */

  function getAuthHeaders(includeJson = false) {
    const token = sessionStorage.getItem(
      "smartInstitutionToken"
    );

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    if (includeJson) {
      headers["Content-Type"] = "application/json";
    }

    return headers;
  }

  /* ===============================
     LOAD MEETINGS
  =============================== */

  useEffect(() => {
    loadMeetings();
  }, []);

  async function loadMeetings() {
    try {
      setLoadingMeetings(true);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/meetings`,
        {
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      console.log("MEETINGS API RESPONSE:", data);

      if (response.status === 401) {
        setMessage(
          "Your session has expired. Please login again."
        );
        return;
      }

      if (!response.ok) {
        setMessage(
          data.message || "Unable to load meetings."
        );
        return;
      }

      let meetingList = [];

      if (Array.isArray(data)) {
        meetingList = data;
      } else if (Array.isArray(data.meetings)) {
        meetingList = data.meetings;
      } else if (Array.isArray(data.data)) {
        meetingList = data.data;
      } else if (
        data.data &&
        Array.isArray(data.data.meetings)
      ) {
        meetingList = data.data.meetings;
      }

      setMeetings(meetingList);

      if (meetingList.length === 0) {
        setMessage(
          "No meetings found. Please create a meeting first."
        );
      }
    } catch (error) {
      console.error("LOAD MEETINGS ERROR:", error);

      setMessage(
        "Unable to connect to the backend."
      );
    } finally {
      setLoadingMeetings(false);
    }
  }

  /* ===============================
     SELECT MEETING
  =============================== */

  async function handleMeetingChange(e) {
    const meetingId = e.target.value;

    setSelectedMeetingId(meetingId);

    setTranscript([]);
    setMinutes(null);

    setSummary("");
    setKeyPoints("");
    setDecisions("");
    setActionItems("");

    setMessage("");

    if (!meetingId) {
      return;
    }

    await Promise.all([
      loadTranscript(meetingId),
      loadMinutes(meetingId),
    ]);
  }

  /* ===============================
     LOAD TRANSCRIPT
  =============================== */

  async function loadTranscript(meetingId) {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/meetings/${meetingId}/transcript`,
        {
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        setMessage(
          "Your session has expired. Please login again."
        );
        return;
      }

      if (!response.ok) {
        console.error(
          "Transcript API error:",
          data
        );
        return;
      }

      if (data.success) {
        setTranscript(
          Array.isArray(data.transcript)
            ? data.transcript
            : []
        );
      }
    } catch (error) {
      console.error(
        "LOAD TRANSCRIPT ERROR:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  /* ===============================
     LOAD MINUTES
  =============================== */

  async function loadMinutes(meetingId) {
    try {
      const response = await fetch(
        `${API_URL}/api/minutes/meeting/${meetingId}`,
        {
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        setMessage(
          "Your session has expired. Please login again."
        );
        return;
      }

      if (!response.ok) {
        return;
      }

      if (data.success && data.data) {
        const item = data.data;

        setMinutes(item);

        setSummary(item.summary || "");
        setKeyPoints(item.key_points || "");
        setDecisions(item.decisions || "");
        setActionItems(item.action_items || "");
      }
    } catch (error) {
      console.error(
        "LOAD MINUTES ERROR:",
        error
      );
    }
  }

  /* ===============================
     CREATE DRAFT
  =============================== */

  async function createDraft() {
    if (!selectedMeetingId) {
      setMessage("Please select a meeting.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/minutes/meeting/${selectedMeetingId}`,
        {
          method: "POST",

          headers: getAuthHeaders(true),

          body: JSON.stringify({
            summary,
            key_points: keyPoints,
            decisions,
            action_items: actionItems,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        setMessage(
          "Your session has expired. Please login again."
        );
        return;
      }

      if (!response.ok) {
        setMessage(
          data.message ||
            "Unable to create draft."
        );
        return;
      }

      setMessage(
        "Minutes draft created successfully."
      );

      await loadMinutes(selectedMeetingId);
    } catch (error) {
      console.error(
        "CREATE DRAFT ERROR:",
        error
      );

      setMessage(
        "Unable to create minutes draft."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ===============================
     UPDATE DRAFT
  =============================== */

  async function updateDraft() {
    if (!minutes?.id) {
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/minutes/${minutes.id}`,
        {
          method: "PUT",

          headers: getAuthHeaders(true),

          body: JSON.stringify({
            summary,
            key_points: keyPoints,
            decisions,
            action_items: actionItems,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        setMessage(
          "Your session has expired. Please login again."
        );
        return;
      }

      if (!response.ok) {
        setMessage(
          data.message ||
            "Unable to update draft."
        );
        return;
      }

      setMessage(
        "Minutes draft updated successfully."
      );

      await loadMinutes(selectedMeetingId);
    } catch (error) {
      console.error(
        "UPDATE DRAFT ERROR:",
        error
      );

      setMessage(
        "Unable to update minutes draft."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ===============================
     SAVE DRAFT
  =============================== */

  async function handleSave() {
    if (minutes?.id) {
      await updateDraft();
    } else {
      await createDraft();
    }
  }

  /* ===============================
     GENERATE AI MINUTES DRAFT
  =============================== */

  async function generateAIDraft() {
    if (!selectedMeetingId) {
      setMessage("Please select a meeting.");
      return;
    }

    if (transcript.length === 0) {
      setMessage(
        "No transcript available. Generate a transcript first."
      );
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/minutes/meeting/${selectedMeetingId}/generate-draft`,
        {
          method: "POST",

          headers: getAuthHeaders(true),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        setMessage(
          "Your session has expired. Please login again."
        );
        return;
      }

      if (!response.ok) {
        setMessage(
          data.message ||
            "Unable to generate AI draft."
        );
        return;
      }

      if (!data.success || !data.draft) {
        setMessage(
          "AI did not return a valid draft."
        );
        return;
      }

      setSummary(data.draft.summary || "");
      setKeyPoints(data.draft.key_points || "");
      setDecisions(data.draft.decisions || "");
      setActionItems(data.draft.action_items || "");

      setMessage(
        "AI draft generated. Please review it before saving."
      );
    } catch (error) {
      console.error(
        "AI DRAFT ERROR:",
        error
      );

      setMessage(
        "Unable to connect to AI service."
      );
    } finally {
      setLoading(false);
    }
  }

  /* ===============================
     APPROVE MINUTES
  =============================== */

  async function approveMinutes() {
    if (!minutes?.id) {
      return;
    }

    const confirmed = window.confirm(
      "Approve these minutes? After approval, they cannot be edited."
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/minutes/${minutes.id}/approve`,
        {
          method: "PATCH",

          headers: getAuthHeaders(true),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        setMessage(
          "Your session has expired. Please login again."
        );
        return;
      }

      if (!response.ok) {
        setMessage(
          data.message ||
            "Unable to approve minutes."
        );
        return;
      }

      setMessage(
        "Minutes approved successfully."
      );

      await loadMinutes(selectedMeetingId);
    } catch (error) {
      console.error(
        "APPROVE MINUTES ERROR:",
        error
      );

      setMessage(
        "Unable to approve minutes."
      );
    } finally {
      setSaving(false);
    }
  }

  /* ===============================
     FORMAT TIME
  =============================== */

  function formatTime(seconds) {
    const total = Math.floor(
      Number(seconds) || 0
    );

    const minutesValue = Math.floor(
      total / 60
    );

    const secondsValue = total % 60;

    return `${String(minutesValue).padStart(
      2,
      "0"
    )}:${String(secondsValue).padStart(
      2,
      "0"
    )}`;
  }

  /* ===============================
     UI
  =============================== */

  return (
    <div className="minutes-page">

      {/* HEADER */}

      <div className="minutes-header">

        <div>

          <button
            className="minutes-back-btn"
            onClick={onBack}
          >
            ← Back
          </button>

          <h1>Meeting Minutes</h1>

          <p>
            Review transcripts and prepare
            official meeting minutes.
          </p>

        </div>

        <div className="minutes-brand">
          EVENTRA
        </div>

      </div>

      <div className="minutes-container">

        {/* MEETING SELECT */}

        <div className="minutes-panel">

          <div className="panel-title">
            Select Meeting
          </div>

          <select
            className="meeting-select"
            value={selectedMeetingId}
            onChange={handleMeetingChange}
            disabled={loadingMeetings}
          >

            <option value="">
              {loadingMeetings
                ? "Loading meetings..."
                : "Select a meeting"}
            </option>

            {meetings.map((meeting) => (
              <option
                key={meeting.id}
                value={meeting.id}
              >
                {meeting.title}

                {meeting.event_date
                  ? ` — ${meeting.event_date}`
                  : ""}
              </option>
            ))}

          </select>

          {meetings.length > 0 && (
            <p className="meeting-count">
              {meetings.length} meeting
              {meetings.length !== 1
                ? "s"
                : ""}{" "}
              available
            </p>
          )}

        </div>

        {/* SELECTED MEETING */}

        {selectedMeetingId && (
          <>

            {/* TRANSCRIPT */}

            <div className="minutes-panel">

              <div className="panel-heading-row">

                <div>

                  <h2>
                    Meeting Transcript
                  </h2>

                  <p>
                    Speaker-wise transcript
                  </p>

                </div>

                <span className="record-count">
                  {transcript.length} records
                </span>

              </div>

              {loading ? (

                <div className="empty-state">
                  Loading transcript...
                </div>

              ) : transcript.length === 0 ? (

                <div className="empty-state">
                  No transcript found for this
                  meeting.
                </div>

              ) : (

                <div className="transcript-list">

                  {transcript.map(
                    (item, index) => (

                      <div
                        className="transcript-item"
                        key={
                          item.id ||
                          `${item.start}-${index}`
                        }
                      >

                        <div className="transcript-time">
                          {formatTime(
                            item.start
                          )}
                        </div>

                        <div className="transcript-content">

                          <strong>
                            {item.speaker ||
                              "Speaker"}
                          </strong>

                          <p>
                            {item.text}
                          </p>

                        </div>

                      </div>

                    )
                  )}

                </div>

              )}

            </div>

            {/* MINUTES EDITOR */}

            <div className="minutes-panel">

              <div className="panel-heading-row">

                <div className="minutes-title-with-ai">

                  <div>

                    <h2>
                      Minutes Draft
                    </h2>

                    <p>
                      Prepare the official
                      meeting record.
                    </p>

                  </div>

                  {minutes?.status !==
                    "Approved" && (

                    <button
                      type="button"
                      className="ai-draft-btn"
                      onClick={
                        generateAIDraft
                      }
                      disabled={
                        loading ||
                        transcript.length ===
                          0 ||
                        saving
                      }
                    >
                      {loading
                        ? "Generating..."
                        : "✨ Generate AI Draft"}
                    </button>

                  )}

                </div>

                {minutes && (
                  <div className="minutes-meta">

                    <span
                      className={
                        minutes.status ===
                        "Approved"
                          ? "status-approved"
                          : "status-draft"
                      }
                    >
                      {minutes.status}
                    </span>

                    <span>
                      v{minutes.version}
                    </span>

                  </div>
                )}

              </div>

              <div className="minutes-form">

                {/* SUMMARY */}

                <div className="field-group">

                  <label>
                    Summary
                  </label>

                  <textarea
                    value={summary}
                    onChange={(e) =>
                      setSummary(
                        e.target.value
                      )
                    }
                    disabled={
                      minutes?.status ===
                      "Approved"
                    }
                    placeholder="Write a concise summary of the meeting..."
                  />

                </div>

                {/* KEY POINTS */}

                <div className="field-group">

                  <label>
                    Key Points
                  </label>

                  <textarea
                    value={keyPoints}
                    onChange={(e) =>
                      setKeyPoints(
                        e.target.value
                      )
                    }
                    disabled={
                      minutes?.status ===
                      "Approved"
                    }
                    placeholder="Enter important discussion points..."
                  />

                </div>

                {/* DECISIONS */}

                <div className="field-group">

                  <label>
                    Decisions
                  </label>

                  <textarea
                    value={decisions}
                    onChange={(e) =>
                      setDecisions(
                        e.target.value
                      )
                    }
                    disabled={
                      minutes?.status ===
                      "Approved"
                    }
                    placeholder="Record decisions taken during the meeting..."
                  />

                </div>

                {/* ACTION ITEMS */}

                <div className="field-group">

                  <label>
                    Action Items
                  </label>

                  <textarea
                    value={actionItems}
                    onChange={(e) =>
                      setActionItems(
                        e.target.value
                      )
                    }
                    disabled={
                      minutes?.status ===
                      "Approved"
                    }
                    placeholder="Record action items, responsible persons and deadlines..."
                  />

                </div>

                {/* AI REVIEW NOTICE */}

                {message &&
                  message.includes(
                    "AI draft generated"
                  ) && (
                    <div className="ai-review-notice">
                      ✨ AI-generated draft —
                      Please verify all facts,
                      decisions and action items
                      before approval.
                    </div>
                  )}

                {/* ACTION BUTTONS */}

                {minutes?.status !==
                  "Approved" && (

                  <div className="minutes-actions">

                    <button
                      className="save-minutes-btn"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving
                        ? "Saving..."
                        : minutes
                        ? "Update Draft"
                        : "Save Draft"}
                    </button>

                    {minutes && (
                      <button
                        className="approve-minutes-btn"
                        onClick={
                          approveMinutes
                        }
                        disabled={saving}
                      >
                        Approve Minutes
                      </button>
                    )}

                  </div>

                )}

                {/* APPROVED */}

                {minutes?.status ===
                  "Approved" && (

                  <div className="approved-notice">
                    ✓ These minutes are
                    officially approved and
                    cannot be edited.
                  </div>

                )}

                {/* NORMAL MESSAGE */}

                {message &&
                  !message.includes(
                    "AI draft generated"
                  ) && (
                    <div className="minutes-message">
                      {message}
                    </div>
                  )}

              </div>

            </div>

          </>
        )}

      </div>

    </div>
  );
}

export default Minutes;