import { useEffect, useState } from "react";
import "./ActivityLog.css";

const API_URL = "http://localhost:5000";

function ActivityLog({ user, onBack }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const [actionFilter, setActionFilter] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");

  const token = sessionStorage.getItem(
    "smartInstitutionToken"
  );

  const fetchActivities = async (requestedPage = page) => {
    try {
      setLoading(true);
      setError("");

      if (!token) {
        throw new Error(
          "Authentication session expired. Please login again."
        );
      }

      const params = new URLSearchParams();

      params.append("page", requestedPage);
      params.append("limit", "20");

      if (actionFilter) {
        params.append("action", actionFilter);
      }

      if (moduleFilter) {
        params.append("module", moduleFilter);
      }

      const response = await fetch(
        `${API_URL}/api/activity-logs?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        throw new Error(
          "Your session has expired. Please login again."
        );
      }

      if (response.status === 403) {
        throw new Error(
          "Only administrators can access the Activity Log."
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Unable to load activity logs."
        );
      }

      setActivities(data.data || []);

      if (data.pagination) {
        setPagination({
          page: Number(data.pagination.page || requestedPage),
          limit: Number(data.pagination.limit || 20),
          total: Number(data.pagination.total || 0),
          totalPages: Number(
            data.pagination.totalPages || 1
          ),
        });
      }

      setPage(requestedPage);
    } catch (error) {
      console.error("Activity Log error:", error);

      setActivities([]);

      setError(
        error.message ||
          "Unable to load activity logs."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role !== "Admin") {
      setLoading(false);
      setError(
        "Only administrators can access the Activity Log."
      );
      return;
    }

    fetchActivities(1);
  }, [actionFilter, moduleFilter]);

  const handleFilterChange = () => {
    setPage(1);
  };

  const handlePrevious = () => {
    if (page > 1) {
      fetchActivities(page - 1);
    }
  };

  const handleNext = () => {
    if (page < pagination.totalPages) {
      fetchActivities(page + 1);
    }
  };

  const formatDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getActivityIcon = (action) => {
    const normalized = String(
      action || ""
    ).toUpperCase();

    if (
      normalized.includes("CREATE") ||
      normalized.includes("ADD")
    ) {
      return "+";
    }

    if (
      normalized.includes("DELETE") ||
      normalized.includes("REMOVE")
    ) {
      return "×";
    }

    if (
      normalized.includes("UPDATE") ||
      normalized.includes("EDIT")
    ) {
      return "↻";
    }

    if (
      normalized.includes("TRANSCRIPT")
    ) {
      return "T";
    }

    return "•";
  };

  const totalActivities = pagination.total || 0;

  return (
    <div className="activity-page">
      <div className="activity-shell">

        {/* HEADER */}

        <header className="activity-header">
          <div>

            <button
              className="activity-back"
              onClick={onBack}
            >
              ← Dashboard
            </button>

            <div className="activity-eyebrow">
              EVENTRA / AUDIT
            </div>

            <h1>
              Activity Log
            </h1>

            <p>
              Track important actions performed
              across the institution.
            </p>

          </div>

          <div className="activity-user">

            <div className="activity-avatar">
              {(
                user?.name ||
                user?.email ||
                "U"
              )
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>
                {user?.name ||
                  user?.email ||
                  "User"}
              </strong>

              <span>
                {user?.role || "Viewer"}
              </span>
            </div>

          </div>
        </header>


        {/* TOOLBAR */}

        {user?.role === "Admin" && (
          <div className="activity-toolbar">

            <div>
              <strong>
                {totalActivities}
              </strong>

              <span>
                {" "}
                Total activities
              </span>
            </div>


            <div
              style={{
                display: "flex",
                gap: "10px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >

              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(
                    e.target.value
                  );
                  handleFilterChange();
                }}
              >
                <option value="">
                  All Actions
                </option>

                <option value="CREATE">
                  Create
                </option>

                <option value="UPDATE">
                  Update
                </option>

                <option value="DELETE">
                  Delete
                </option>

                <option value="TRANSCRIPT_GENERATE">
                  Transcript Generate
                </option>

                <option value="TRANSCRIPT_SAVE">
                  Transcript Save
                </option>
              </select>


              <select
                value={moduleFilter}
                onChange={(e) => {
                  setModuleFilter(
                    e.target.value
                  );
                  handleFilterChange();
                }}
              >
                <option value="">
                  All Modules
                </option>

                <option value="Meetings">
                  Meetings
                </option>

                <option value="Events">
                  Events
                </option>

                <option value="Policies">
                  Policies
                </option>

                <option value="Documents">
                  Documents
                </option>

                <option value="Minutes">
                  Minutes
                </option>
              </select>


              <button
                onClick={() =>
                  fetchActivities(page)
                }
                className="activity-refresh"
              >
                ↻ Refresh
              </button>

            </div>

          </div>
        )}


        {/* LOADING */}

        {loading && (
          <div className="activity-state">
            Loading activity history...
          </div>
        )}


        {/* ERROR */}

        {!loading && error && (
          <div className="activity-state error">
            {error}
          </div>
        )}


        {/* EMPTY */}

        {!loading &&
          !error &&
          activities.length === 0 && (
            <div className="activity-state">
              No activity recorded yet.
            </div>
          )}


        {/* ACTIVITY LIST */}

        {!loading &&
          !error &&
          activities.length > 0 && (
            <div className="activity-list">

              {activities.map((item) => (
                <div
                  className="activity-card"
                  key={item.id}
                >

                  <div className="activity-icon">
                    {getActivityIcon(
                      item.action
                    )}
                  </div>


                  <div className="activity-main">

                    <div className="activity-top">

                      <h3>
                        {item.description ||
                          "Activity recorded"}
                      </h3>

                      <span className="activity-time">
                        {formatDate(
                          item.created_at
                        )}
                      </span>

                    </div>


                    <p>
                      {item.user_name ||
                        "System"}{" "}
                      performed{" "}
                      <strong>
                        {item.action ||
                          "ACTION"}
                      </strong>{" "}
                      in{" "}
                      <strong>
                        {item.module ||
                          "System"}
                      </strong>

                      {item.record_id
                        ? ` • Record #${item.record_id}`
                        : ""}
                    </p>


                    <div className="activity-meta">

                      <span>
                        {item.module ||
                          "System"}
                      </span>

                      <span>
                        {item.action ||
                          "ACTION"}
                      </span>

                      <span>
                        {item.user_role ||
                          "System"}
                      </span>

                    </div>

                  </div>

                </div>
              ))}

            </div>
          )}


        {/* PAGINATION */}

        {!loading &&
          !error &&
          pagination.totalPages > 1 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "16px",
                marginTop: "24px",
                paddingBottom: "24px",
              }}
            >

              <button
                onClick={handlePrevious}
                disabled={page <= 1}
              >
                ← Previous
              </button>

              <span>
                Page{" "}
                <strong>
                  {page}
                </strong>{" "}
                of{" "}
                <strong>
                  {pagination.totalPages}
                </strong>
              </span>

              <button
                onClick={handleNext}
                disabled={
                  page >=
                  pagination.totalPages
                }
              >
                Next →
              </button>

            </div>
          )}

      </div>
    </div>
  );
}

export default ActivityLog;