import { useEffect, useMemo, useState } from "react";
import "./Policies.css";
import { getPermissions } from "./permissions";

const API_URL = "http://localhost:5000";

function Policies({ user, onBack }) {
  const permissions = getPermissions(user?.role);

  const canCreate = permissions.policies?.create;
  const canEdit = permissions.policies?.edit;
  const canDelete = permissions.policies?.delete;
  const canHistory = permissions.policies?.history;

  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    title: "",
    policy_number: "",
    department: "",
    description: "",
    effective_date: "",
    document_path: "",
  });

  const [historyPolicy, setHistoryPolicy] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [selectedVersionA, setSelectedVersionA] = useState("");
  const [selectedVersionB, setSelectedVersionB] = useState("");

  // AUTHENTICATION HEADERS

  function getAuthHeaders(extraHeaders = {}) {
    const token = sessionStorage.getItem(
      "smartInstitutionToken"
    );

    if (!token) {
      throw new Error("Session expired. Please login again.");
    }

    return {
      ...extraHeaders,
      Authorization: `Bearer ${token}`,
    };
  }

  // LOAD POLICIES

  async function fetchPolicies() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/policies`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        throw new Error("Session expired. Please login again.");
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load policies."
        );
      }

      setPolicies(
        Array.isArray(data.data) ? data.data : []
      );
    } catch (err) {
      console.error("Fetch policies error:", err);
      setError(err.message || "Unable to load policies.");
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPolicies();
  }, []);

  // FORM HELPERS

  function resetForm() {
    setForm({
      title: "",
      policy_number: "",
      department: "",
      description: "",
      effective_date: "",
      document_path: "",
    });

    setEditingId(null);
  }

  function openCreateForm() {
    if (!canCreate) return;

    resetForm();
    setError("");
    setMessage("");
    setShowForm(true);
  }

  function openEditForm(policy) {
    if (!canEdit) return;

    setEditingId(policy.id);

    setForm({
      title: policy.title || "",
      policy_number: policy.policy_number || "",
      department: policy.department || "",
      description: policy.description || "",
      effective_date: policy.effective_date
        ? String(policy.effective_date).slice(0, 10)
        : "",
      document_path: policy.document_path || "",
    });

    setError("");
    setMessage("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    resetForm();
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // CREATE / UPDATE

  async function handleSubmit(event) {
    event.preventDefault();

    if (editingId && !canEdit) return;
    if (!editingId && !canCreate) return;

    if (!form.title.trim()) {
      setError("Policy title is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const payload = {
        title: form.title.trim(),
        policy_number: form.policy_number.trim(),
        department: form.department.trim(),
        description: form.description.trim(),
        effective_date: form.effective_date || null,
        document_path: form.document_path.trim(),
      };

      const url = editingId
        ? `${API_URL}/api/policies/${editingId}`
        : `${API_URL}/api/policies`;

      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.status === 401) {
        throw new Error("Session expired. Please login again.");
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to save policy."
        );
      }

      setMessage(
        editingId
          ? "Policy updated successfully."
          : "Policy created successfully."
      );

      closeForm();
      await fetchPolicies();
    } catch (err) {
      console.error("Policy save error:", err);
      setError(err.message || "Unable to save policy.");
    } finally {
      setSaving(false);
    }
  }

  // DELETE

  async function handleDelete(id) {
    if (!canDelete) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this policy?"
    );

    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/policies/${id}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        throw new Error("Session expired. Please login again.");
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to delete policy."
        );
      }

      setPolicies((previous) =>
        previous.filter((policy) => policy.id !== id)
      );

      setMessage("Policy deleted successfully.");
    } catch (err) {
      console.error("Policy delete error:", err);
      setError(err.message || "Unable to delete policy.");
    }
  }

  // VERSION HISTORY

  async function openHistory(policy) {
    if (!canHistory) return;

    try {
      setHistoryPolicy(policy);
      setHistory([]);
      setLoadingHistory(true);
      setError("");

      setSelectedVersionA("");
      setSelectedVersionB("");

      const response = await fetch(
        `${API_URL}/api/policies/${policy.id}/versions`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        throw new Error("Session expired. Please login again.");
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load policy history."
        );
      }

      const versions = Array.isArray(data.data)
        ? data.data
        : [];

      setHistory(versions);

      if (versions.length >= 2) {
        setSelectedVersionA(String(versions[1].id));
        setSelectedVersionB(String(versions[0].id));
      } else if (versions.length === 1) {
        setSelectedVersionA(String(versions[0].id));
        setSelectedVersionB(String(versions[0].id));
      }
    } catch (err) {
      console.error("Policy history error:", err);
      setError(err.message || "Unable to load policy history.");
    } finally {
      setLoadingHistory(false);
    }
  }

  function closeHistory() {
    setHistoryPolicy(null);
    setHistory([]);
    setSelectedVersionA("");
    setSelectedVersionB("");
  }

  const versionA = useMemo(
    () =>
      history.find(
        (item) => String(item.id) === String(selectedVersionA)
      ) || null,
    [history, selectedVersionA]
  );

  const versionB = useMemo(
    () =>
      history.find(
        (item) => String(item.id) === String(selectedVersionB)
      ) || null,
    [history, selectedVersionB]
  );

  // HELPERS

  function valuesAreDifferent(firstValue, secondValue) {
    const first = String(firstValue ?? "")
      .trim()
      .replace(/\r\n/g, "\n");

    const second = String(secondValue ?? "")
      .trim()
      .replace(/\r\n/g, "\n");

    return first !== second;
  }

  function formatDate(value) {
    if (!value) return "—";
    return String(value).slice(0, 10) || "—";
  }

  function formatDateTime(value) {
    if (!value) return "—";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleString();
  }

  const filteredPolicies = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    if (!searchText) return policies;

    return policies.filter((policy) =>
      [
        policy.title,
        policy.policy_number,
        policy.department,
        policy.description,
      ].some((value) =>
        String(value || "").toLowerCase().includes(searchText)
      )
    );
  }, [policies, search]);

  function renderDiffRow(label, oldValue, newValue) {
    const changed = valuesAreDifferent(oldValue, newValue);

    return (
      <div
        className={`policy-diff-row ${
          changed ? "policy-diff-changed" : ""
        }`}
        key={label}
      >
        <div className="policy-diff-label">{label}</div>

        <div
          className={`policy-diff-value ${
            changed ? "policy-diff-old" : ""
          }`}
        >
          {oldValue || "—"}
        </div>

        <div
          className={`policy-diff-value ${
            changed ? "policy-diff-new" : ""
          }`}
        >
          {newValue || "—"}
        </div>
      </div>
    );
  }

  // UI

  return (
    <div className="policies-page">

      <div className="policies-header">
        <div>
          <button
            type="button"
            className="policy-back-btn"
            onClick={onBack}
          >
            ← Back
          </button>

          <h1>Policy & Rules Repository</h1>

          <p>
            Manage institutional policies with version history
            and audit-ready records.
          </p>
        </div>

        <div className="policy-header-actions">
          <button
            type="button"
            className="policy-refresh-btn"
            onClick={fetchPolicies}
            disabled={loading}
          >
            ↻ Refresh
          </button>

          {canCreate && (
            <button
              type="button"
              className="policy-create-btn"
              onClick={openCreateForm}
            >
              + Create Policy
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="policy-success-message">
          {message}
        </div>
      )}

      {error && (
        <div className="policy-error-message">
          {error}
        </div>
      )}

      <div className="policy-toolbar">
        <input
          type="text"
          className="policy-search"
          placeholder="Search policies..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="policy-count">
          {filteredPolicies.length}{" "}
          {filteredPolicies.length === 1 ? "Policy" : "Policies"}
        </div>
      </div>

      {loading ? (
        <div className="policy-empty-state">
          Loading policies...
        </div>
      ) : filteredPolicies.length === 0 ? (
        <div className="policy-empty-state">
          <h3>
            {search.trim() ? "No policies found" : "No policies yet"}
          </h3>

          <p>
            {search.trim()
              ? "Try a different search term."
              : "Create your first institutional policy."}
          </p>

          {!search.trim() && canCreate && (
            <button
              type="button"
              className="policy-create-btn"
              onClick={openCreateForm}
            >
              + Create Policy
            </button>
          )}
        </div>
      ) : (
        <div className="policy-table-wrapper">
          <table className="policy-table">
            <thead>
              <tr>
                <th>Policy</th>
                <th>Policy No.</th>
                <th>Department</th>
                <th>Effective Date</th>
                <th>Version</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredPolicies.map((policy) => (
                <tr key={policy.id}>
                  <td>
                    <div className="policy-title">
                      {policy.title}
                    </div>

                    {policy.description && (
                      <div className="policy-description">
                        {policy.description}
                      </div>
                    )}
                  </td>

                  <td>{policy.policy_number || "—"}</td>
                  <td>{policy.department || "—"}</td>
                  <td>{formatDate(policy.effective_date)}</td>

                  <td>
                    <span className="policy-version">
                      v{policy.version || "1.0"}
                    </span>
                  </td>

                  <td>{formatDateTime(policy.created_at)}</td>

                  <td>
                    <div className="policy-actions">
                      {canHistory && (
                        <button
                          type="button"
                          className="policy-action-btn history"
                          onClick={() => openHistory(policy)}
                        >
                          History
                        </button>
                      )}

                      {canEdit && (
                        <button
                          type="button"
                          className="policy-action-btn edit"
                          onClick={() => openEditForm(policy)}
                        >
                          Edit
                        </button>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          className="policy-action-btn delete"
                          onClick={() => handleDelete(policy.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}

      {showForm && (
        <div className="policy-modal-overlay">
          <div className="policy-modal">

            <div className="policy-modal-header">
              <div>
                <h2>
                  {editingId ? "Edit Policy" : "Create Policy"}
                </h2>

                <p>
                  {editingId
                    ? "Updating the policy creates a new version."
                    : "Create a new institutional policy record."}
                </p>
              </div>

              <button
                type="button"
                className="policy-modal-close"
                onClick={closeForm}
              >
                ×
              </button>
            </div>

            <form className="policy-form" onSubmit={handleSubmit}>
              <div className="policy-form-grid">

                <div className="policy-form-group">
                  <label>Policy Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    placeholder="Enter policy title"
                    maxLength={200}
                    required
                  />
                </div>

                <div className="policy-form-group">
                  <label>Policy Number</label>
                  <input
                    type="text"
                    name="policy_number"
                    value={form.policy_number}
                    onChange={handleChange}
                    placeholder="e.g. POL-001"
                    maxLength={100}
                  />
                </div>

                <div className="policy-form-group">
                  <label>Department</label>
                  <input
                    type="text"
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    placeholder="e.g. Administration"
                    maxLength={150}
                  />
                </div>

                <div className="policy-form-group">
                  <label>Effective Date</label>
                  <input
                    type="date"
                    name="effective_date"
                    value={form.effective_date}
                    onChange={handleChange}
                  />
                </div>

              </div>

              <div className="policy-form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Enter policy description..."
                  rows={6}
                  maxLength={10000}
                />
              </div>

              <div className="policy-form-group">
                <label>Document Path / Reference</label>
                <input
                  type="text"
                  name="document_path"
                  value={form.document_path}
                  onChange={handleChange}
                  placeholder="Optional document reference"
                  maxLength={255}
                />
              </div>

              {error && (
                <div className="policy-error-message">
                  {error}
                </div>
              )}

              <div className="policy-form-actions">
                <button
                  type="button"
                  className="policy-cancel-btn"
                  onClick={closeForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="policy-save-btn"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Policy"
                    : "Create Policy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VERSION HISTORY MODAL */}

      {historyPolicy && (
        <div className="policy-modal-overlay">
          <div className="policy-modal history-modal">

            <div className="policy-modal-header">
              <div>
                <h2>Version History</h2>
                <p>{historyPolicy.title}</p>
              </div>

              <button
                type="button"
                className="policy-modal-close"
                onClick={closeHistory}
              >
                ×
              </button>
            </div>

            {loadingHistory ? (
              <div className="policy-empty-state">
                Loading version history...
              </div>
            ) : history.length === 0 ? (
              <div className="policy-empty-state">
                No version history found.
              </div>
            ) : (
              <div className="policy-history-content">

                <div className="policy-version-selector">
                  <div className="version-selector-box">
                    <label>Compare From</label>

                    <select
                      value={selectedVersionA}
                      onChange={(event) =>
                        setSelectedVersionA(event.target.value)
                      }
                    >
                      {history.map((version) => (
                        <option
                          key={`from-${version.id}`}
                          value={version.id}
                        >
                          v{version.version} —{" "}
                          {formatDateTime(version.created_at)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="version-arrow">→</div>

                  <div className="version-selector-box">
                    <label>Compare To</label>

                    <select
                      value={selectedVersionB}
                      onChange={(event) =>
                        setSelectedVersionB(event.target.value)
                      }
                    >
                      {history.map((version) => (
                        <option
                          key={`to-${version.id}`}
                          value={version.id}
                        >
                          v{version.version} —{" "}
                          {formatDateTime(version.created_at)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {versionA && versionB && (
                  <>
                    <div className="policy-compare-info">
                      <div className="compare-info-card old">
                        <span>Older / From</span>
                        <strong>v{versionA.version}</strong>
                        <small>
                          {formatDateTime(versionA.created_at)}
                        </small>
                      </div>

                      <div className="compare-info-arrow">→</div>

                      <div className="compare-info-card new">
                        <span>Newer / To</span>
                        <strong>v{versionB.version}</strong>
                        <small>
                          {formatDateTime(versionB.created_at)}
                        </small>
                      </div>
                    </div>

                    <div className="policy-side-by-side">
                      <div className="policy-side-title">
                        Version Comparison
                      </div>

                      <div className="policy-diff-header">
                        <div>Field</div>
                        <div>v{versionA.version}</div>
                        <div>v{versionB.version}</div>
                      </div>

                      {renderDiffRow(
                        "Title",
                        versionA.title,
                        versionB.title
                      )}

                      {renderDiffRow(
                        "Policy Number",
                        versionA.policy_number,
                        versionB.policy_number
                      )}

                      {renderDiffRow(
                        "Department",
                        versionA.department,
                        versionB.department
                      )}

                      {renderDiffRow(
                        "Effective Date",
                        formatDate(versionA.effective_date),
                        formatDate(versionB.effective_date)
                      )}

                      {renderDiffRow(
                        "Document",
                        versionA.document_path,
                        versionB.document_path
                      )}

                      {renderDiffRow(
                        "Description",
                        versionA.description,
                        versionB.description
                      )}
                    </div>

                    <div className="policy-diff-legend">
                      <div className="legend-item">
                        <span className="legend-dot old-dot"></span>
                        Old / changed value
                      </div>

                      <div className="legend-item">
                        <span className="legend-dot new-dot"></span>
                        New / changed value
                      </div>

                      <div className="legend-item">
                        <span className="legend-dot same-dot"></span>
                        Unchanged
                      </div>
                    </div>
                  </>
                )}

                <div className="policy-history-section">
                  <div className="policy-history-section-title">
                    All Versions
                  </div>

                  <div className="policy-history-list">
                    {history.map((version) => (
                      <div
                        className={`policy-history-card ${
                          String(version.id) === String(selectedVersionA) ||
                          String(version.id) === String(selectedVersionB)
                            ? "selected-version-card"
                            : ""
                        }`}
                        key={version.id}
                      >
                        <div className="history-card-top">
                          <span className="policy-version">
                            v{version.version}
                          </span>

                          <span>
                            {formatDateTime(version.created_at)}
                          </span>
                        </div>

                        <h3>{version.title}</h3>

                        <div className="history-meta">
                          <span>
                            Policy No: {version.policy_number || "—"}
                          </span>

                          <span>
                            Department: {version.department || "—"}
                          </span>

                          <span>
                            Effective: {formatDate(version.effective_date)}
                          </span>
                        </div>

                        {version.description && (
                          <p>{version.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Policies;