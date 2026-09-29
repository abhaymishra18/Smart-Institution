import { useEffect, useState } from "react";
import "./Events.css";
import { getPermissions } from "./permissions";

const API_URL = "http://localhost:5000";

function Events({ user, onBack }) {
  const permissions = getPermissions(user?.role);

  const canCreate = permissions.events?.create;
  const canEdit = permissions.events?.edit;
  const canDelete = permissions.events?.delete;

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    title: "",
    event_date: "",
    event_time: "",
    location: "",
    description: "",
    organizer: "",
  };

  const [form, setForm] = useState(emptyForm);

  // --------------------------------
  // AUTH HEADERS
  // --------------------------------
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

  // --------------------------------
  // LOAD EVENTS
  // --------------------------------
  async function fetchEvents() {
    try {
      setLoading(true);
      setError("");

      const token = sessionStorage.getItem(
        "smartInstitutionToken"
      );

      if (!token) {
        setError("Session expired. Please login again.");
        return;
      }

      const response = await fetch(
        `${API_URL}/api/events`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        setError(
          "Session expired. Please login again."
        );
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load events."
        );
      }

      setEvents(data.data || []);
    } catch (err) {
      console.error("Events load error:", err);
      setError(
        err.message || "Unable to load events."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
  }, []);

  // --------------------------------
  // FORM CHANGE
  // --------------------------------
  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // --------------------------------
  // CREATE FORM
  // --------------------------------
  function openCreateForm() {
    if (!canCreate) return;

    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  }

  // --------------------------------
  // EDIT
  // --------------------------------
  function handleEdit(event) {
    if (!canEdit) return;

    setEditingId(event.id);

    setForm({
      title: event.title || "",
      event_date: event.event_date
        ? String(event.event_date).slice(0, 10)
        : "",
      event_time: event.event_time
        ? String(event.event_time).slice(0, 5)
        : "",
      location: event.location || "",
      description: event.description || "",
      organizer: event.organizer || "",
    });

    setError("");
    setShowForm(true);
  }

  // --------------------------------
  // CLOSE FORM
  // --------------------------------
  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  // --------------------------------
  // SAVE EVENT
  // --------------------------------
  async function handleSubmit(event) {
    event.preventDefault();

    if (editingId && !canEdit) return;
    if (!editingId && !canCreate) return;

    if (!form.title.trim()) {
      setError("Event title is required.");
      return;
    }

    if (!form.event_date) {
      setError("Event date is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        title: form.title.trim(),
        event_date: form.event_date,
        event_time: form.event_time || null,
        location: form.location.trim(),
        description: form.description.trim(),
        organizer: form.organizer.trim(),

        // IMPORTANT:
        // created_by is intentionally NOT sent.
        // Backend gets user identity from JWT.
      };

      const url = editingId
        ? `${API_URL}/api/events/${editingId}`
        : `${API_URL}/api/events`;

      const method = editingId
        ? "PUT"
        : "POST";

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(true),
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.status === 401) {
        throw new Error(
          "Session expired. Please login again."
        );
      }

      if (response.status === 403) {
        throw new Error(
          "You do not have permission to perform this action."
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to save event."
        );
      }

      closeForm();

      await fetchEvents();
    } catch (err) {
      console.error("Event save error:", err);

      setError(
        err.message || "Unable to save event."
      );
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------
  // DELETE EVENT
  // --------------------------------
  async function handleDelete(id) {
    if (!canDelete) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this event?"
    );

    if (!confirmed) return;

    try {
      setError("");

      const response = await fetch(
        `${API_URL}/api/events/${id}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        throw new Error(
          "Session expired. Please login again."
        );
      }

      if (response.status === 403) {
        throw new Error(
          "Only an Admin can delete events."
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to delete event."
        );
      }

      await fetchEvents();
    } catch (err) {
      console.error("Event delete error:", err);

      setError(
        err.message ||
          "Unable to delete event."
      );
    }
  }

  // --------------------------------
  // DATE FORMAT
  // --------------------------------
  function formatDate(date) {
    if (!date) return "—";

    const safeDate = String(date).slice(0, 10);

    return new Date(
      `${safeDate}T00:00:00`
    ).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // --------------------------------
  // TIME FORMAT
  // --------------------------------
  function formatTime(time) {
    if (!time) return "";

    const parts = String(time).split(":");

    if (parts.length < 2) return "";

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes)
    ) {
      return "";
    }

    const date = new Date();

    date.setHours(
      hours,
      minutes,
      0,
      0
    );

    return date.toLocaleTimeString(
      "en-IN",
      {
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  }

  return (
    <div className="events-page">
      <div className="events-bg-orb orb-one"></div>
      <div className="events-bg-orb orb-two"></div>
      <div className="events-grid"></div>

      <div className="events-container">

        {/* HEADER */}
        <header className="events-header">
          <div>
            <button
              type="button"
              className="back-btn"
              onClick={onBack}
            >
              ← Dashboard
            </button>

            <div className="events-eyebrow">
              EVENTRA / EVENTS
            </div>

            <h1>Events</h1>

            <p>
              Manage institutional events,
              schedules and event records
              from one place.
            </p>
          </div>

          <div className="events-header-user">
            <div className="user-avatar">
              {(user?.name || "U")
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>
                {user?.name || "User"}
              </strong>

              <span>
                {user?.role || "Viewer"}
              </span>
            </div>
          </div>
        </header>

        {/* TOOLBAR */}
        <div className="events-toolbar">
          <button
            type="button"
            className="refresh-events-btn"
            onClick={fetchEvents}
          >
            ↻ Refresh
          </button>

          {canCreate && (
            <button
              type="button"
              className="create-event-btn"
              onClick={openCreateForm}
            >
              + Create Event
            </button>
          )}
        </div>

        {/* ERROR */}
        {error && (
          <div className="events-error">
            {error}
          </div>
        )}

        {/* FORM */}
        {showForm && (
          <div className="event-form-card">
            <div className="event-form-header">
              <div>
                <span>
                  {editingId
                    ? "EDIT EVENT"
                    : "NEW EVENT"}
                </span>

                <h2>
                  {editingId
                    ? "Edit Event"
                    : "Create New Event"}
                </h2>
              </div>

              <button
                type="button"
                className="close-form-btn"
                onClick={closeForm}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="event-form-grid">

                <div className="form-field">
                  <label>
                    Event Title *
                  </label>

                  <input
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Enter event title"
                    maxLength={200}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>
                    Date *
                  </label>

                  <input
                    type="date"
                    name="event_date"
                    value={form.event_date}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>
                    Time
                  </label>

                  <input
                    type="time"
                    name="event_time"
                    value={form.event_time}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-field">
                  <label>
                    Location
                  </label>

                  <input
                    type="text"
                    name="location"
                    value={form.location}
                    onChange={handleChange}
                    placeholder="Event location"
                    maxLength={200}
                  />
                </div>

                <div className="form-field">
                  <label>
                    Organizer
                  </label>

                  <input
                    type="text"
                    name="organizer"
                    value={form.organizer}
                    onChange={handleChange}
                    placeholder="Organizer name"
                    maxLength={150}
                  />
                </div>

                <div className="form-field full-width">
                  <label>
                    Description
                  </label>

                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    placeholder="Event description..."
                    rows="4"
                    maxLength={2000}
                  />
                </div>

              </div>

              <div className="event-form-actions">
                <button
                  type="button"
                  className="cancel-event-btn"
                  onClick={closeForm}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="save-event-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Event"
                    : "Save Event"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* EVENTS */}
        <section className="events-content">

          {loading ? (
            <div className="events-state">
              <div className="events-loader"></div>

              <p>
                Loading events...
              </p>
            </div>
          ) : events.length === 0 ? (
            <div className="events-state">
              <div className="empty-event-icon">
                ◌
              </div>

              <h3>
                No events found
              </h3>

              <p>
                {canCreate
                  ? "Create your first institutional event."
                  : "No institutional events are available."}
              </p>
            </div>
          ) : (
            <div className="events-list">

              {events.map((event) => (
                <article
                  className="event-card"
                  key={event.id}
                >

                  <div className="event-card-top">
                    <div>
                      <span className="event-date-badge">
                        {formatDate(
                          event.event_date
                        )}
                      </span>

                      <h2>
                        {event.title}
                      </h2>
                    </div>

                    {event.event_time && (
                      <span className="event-time">
                        {formatTime(
                          event.event_time
                        )}
                      </span>
                    )}
                  </div>

                  <div className="event-meta">

                    {event.location && (
                      <span>
                        📍 {event.location}
                      </span>
                    )}

                    {event.organizer && (
                      <span>
                        👤 {event.organizer}
                      </span>
                    )}

                  </div>

                  {event.description && (
                    <p className="event-description">
                      {event.description}
                    </p>
                  )}

                  {(canEdit || canDelete) && (
                    <div className="event-card-actions">

                      {canEdit && (
                        <button
                          type="button"
                          className="event-action-btn edit-btn"
                          onClick={() =>
                            handleEdit(event)
                          }
                        >
                          Edit
                        </button>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          className="event-action-btn delete-btn"
                          onClick={() =>
                            handleDelete(event.id)
                          }
                        >
                          Delete
                        </button>
                      )}

                    </div>
                  )}

                </article>
              ))}

            </div>
          )}

        </section>

        {/* FOOTER */}
        <footer className="events-footer">
          Logged in as{" "}
          <strong>
            {user?.name || "User"}
          </strong>

          {" • "}

          {user?.role || "Viewer"}
        </footer>

      </div>
    </div>
  );
}

export default Events;