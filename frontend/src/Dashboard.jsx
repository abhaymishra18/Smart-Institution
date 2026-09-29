import { useEffect, useState } from "react";
import Meetings from "./Meetings";
import Minutes from "./Minutes";
import Events from "./Events";
import Policies from "./Policies";
import Documents from "./Documents";
import ActivityLog from "./ActivityLog";
import "./Dashboard.css";
import { getPermissions } from "./permissions";

const API_URL = "http://localhost:5000";

/* =====================================
   ADMIN USER MANAGEMENT
===================================== */

function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const getToken = () =>
    sessionStorage.getItem("smartInstitutionToken");

  const loadUsers = async () => {
    setLoading(true);
    setError("");

    try {
      const token = getToken();

      if (!token) {
        setError("Login session not found. Please login again.");
        return;
      }

      const response = await fetch(`${API_URL}/api/users`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to load users."
        );
      }

      const list = Array.isArray(result.data)
        ? result.data
        : Array.isArray(result.users)
        ? result.users
        : [];

      setUsers(list);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  /* =====================================
     COMMON USER ACTION
  ===================================== */

  const performAction = async (
    userId,
    action,
    extraData = {}
  ) => {
    setBusyId(Number(userId));
    setError("");
    setNotice("");

    try {
      const token = getToken();

      if (!token) {
        throw new Error(
          "Login session expired. Please login again."
        );
      }

      const response = await fetch(
        `${API_URL}/api/users/${userId}/${action}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(extraData),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Action failed."
        );
      }

      setNotice(
        result.message || "User updated successfully."
      );

      await loadUsers();
    } catch (err) {
      setError(err.message || "Unable to update user.");
    } finally {
      setBusyId(null);
    }
  };

  /* =====================================
     REMOVE USER
  ===================================== */

  const handleRemoveUser = async (item) => {
    const confirmed = window.confirm(
      `Are you sure you want to remove ${
        item.name || item.email
      }?\n\nTheir account access will be disabled. Historical institutional records will be retained.`
    );

    if (!confirmed) return;

    setBusyId(Number(item.id));
    setError("");
    setNotice("");

    try {
      const token = getToken();

      if (!token) {
        throw new Error(
          "Login session expired. Please login again."
        );
      }

      const response = await fetch(
        `${API_URL}/api/users/${item.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to remove user."
        );
      }

      setNotice(
        result.message || "User removed successfully."
      );

      await loadUsers();
    } catch (err) {
      setError(err.message || "Unable to remove user.");
    } finally {
      setBusyId(null);
    }
  };

  /* =====================================
     RESTORE USER
  ===================================== */

  const handleRestoreUser = async (item) => {
    const confirmed = window.confirm(
      `Restore ${item.name || item.email}?\n\nThe account will be restored as Blocked. You can reactivate it separately.`
    );

    if (!confirmed) return;

    await performAction(item.id, "restore");
  };

  /* =====================================
     CHANGE ROLE
  ===================================== */

  const handleRoleChange = async (userId, role) => {
    const confirmed = window.confirm(
      `Change this user's role to ${role}?`
    );

    if (!confirmed) {
      await loadUsers();
      return;
    }

    await performAction(userId, "role", { role });
  };

  /* =====================================
     STATUS STYLE
  ===================================== */

  const statusClass = (status) => {
    if (status === "Approved") {
      return "user-status-approved";
    }

    if (
      status === "Blocked" ||
      status === "Deleted"
    ) {
      return "user-status-blocked";
    }

    return "user-status-pending";
  };

  /* =====================================
     USER MANAGEMENT UI
  ===================================== */

  return (
    <div className="user-management-page">
      <div className="user-management-heading">
        <div>
          <p className="user-management-eyebrow">
            ADMINISTRATION
          </p>

          <h1>User Management</h1>

          <p className="user-management-subtitle">
            Approve accounts and manage institutional access.
          </p>
        </div>

        <button
          type="button"
          className="user-refresh-button"
          onClick={loadUsers}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      {error && (
        <div
          className="user-message user-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          className="user-message user-success"
          role="status"
        >
          {notice}
        </div>
      )}

      <div className="user-management-table-wrap">
        <table className="user-management-table">
          <thead>
            <tr>
              <th>USER</th>
              <th>EMAIL</th>
              <th>ROLE</th>
              <th>STATUS</th>
              <th>ACTIONS</th>
            </tr>
          </thead>

          <tbody>
            {users.map((item) => {
              const isSelf =
                Number(item.id) === Number(currentUser?.id);

              const isBusy =
                busyId === Number(item.id);

              const isDeleted =
                item.account_status === "Deleted";

              return (
                <tr key={item.id}>
                  {/* USER */}

                  <td>
                    <div className="user-name-cell">
                      <div className="user-table-avatar">
                        {(item.name || "U")
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div>
                        <strong>
                          {item.name || "Unnamed User"}
                        </strong>

                        {isSelf && (
                          <small className="user-you-label">
                            You
                          </small>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* EMAIL */}

                  <td>{item.email}</td>

                  {/* ROLE */}

                  <td>
                    <select
                      value={item.role}
                      disabled={
                        isBusy || isSelf || isDeleted
                      }
                      onChange={(event) =>
                        handleRoleChange(
                          item.id,
                          event.target.value
                        )
                      }
                      aria-label={`Role for ${item.email}`}
                    >
                      <option value="Admin">Admin</option>
                      <option value="Member">Member</option>
                      <option value="Viewer">Viewer</option>
                    </select>
                  </td>

                  {/* STATUS */}

                  <td>
                    <span
                      className={`user-status ${statusClass(
                        item.account_status
                      )}`}
                    >
                      {item.account_status || "Unknown"}
                    </span>
                  </td>

                  {/* ACTIONS */}

                  <td>
                    <div className="user-action-buttons">

                      {/* APPROVE */}

                      {item.account_status === "Pending" && (
                        <button
                          type="button"
                          className="user-action-approve"
                          disabled={isBusy}
                          onClick={() =>
                            performAction(
                              item.id,
                              "approve"
                            )
                          }
                        >
                          {isBusy
                            ? "Please wait..."
                            : "✓ Approve"}
                        </button>
                      )}

                      {/* BLOCK */}

                      {item.account_status === "Approved" &&
                        !isSelf && (
                          <button
                            type="button"
                            className="user-action-block"
                            disabled={isBusy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Block access for ${item.email}?`
                                )
                              ) {
                                performAction(
                                  item.id,
                                  "block"
                                );
                              }
                            }}
                          >
                            {isBusy
                              ? "Please wait..."
                              : "⊘ Block"}
                          </button>
                        )}

                      {/* REACTIVATE BLOCKED USER */}

                      {item.account_status === "Blocked" && (
                        <button
                          type="button"
                          className="user-action-reactivate"
                          disabled={isBusy}
                          onClick={() =>
                            performAction(
                              item.id,
                              "reactivate"
                            )
                          }
                        >
                          {isBusy
                            ? "Please wait..."
                            : "↻ Reactivate"}
                        </button>
                      )}

                      {/* REMOVE USER */}

                      {!isSelf && !isDeleted && (
                        <button
                          type="button"
                          className="user-action-block"
                          disabled={isBusy}
                          onClick={() =>
                            handleRemoveUser(item)
                          }
                        >
                          {isBusy
                            ? "Please wait..."
                            : "✕ Remove"}
                        </button>
                      )}

                      {/* RESTORE REMOVED USER */}

                      {!isSelf && isDeleted && (
                        <button
                          type="button"
                          className="user-action-reactivate"
                          disabled={isBusy}
                          onClick={() =>
                            handleRestoreUser(item)
                          }
                        >
                          {isBusy
                            ? "Please wait..."
                            : "↶ Restore"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {!loading && users.length === 0 && (
              <tr>
                <td
                  colSpan="5"
                  className="user-empty-state"
                >
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="user-management-note">
        Your own role and account access cannot be changed from
        this screen. Removed users' historical records are
        retained.
      </p>
    </div>
  );
}

/* =====================================
   DASHBOARD
===================================== */

function Dashboard({ user, onLogout }) {
  const [currentPage, setCurrentPage] =
    useState("dashboard");

  const [stats, setStats] = useState({
    meetings: 0,
    events: 0,
    policies: 0,
    documents: 0,
  });

  const permissions = getPermissions(user?.role);
  const isAdmin = user?.role === "Admin";

  useEffect(() => {
    fetchStats();
  }, []);

  /* =====================================
     FETCH DASHBOARD STATS
  ===================================== */

  const fetchStats = async () => {
    try {
      const token = sessionStorage.getItem(
        "smartInstitutionToken"
      );

      if (!token) {
        console.error("Login token not found");
        return;
      }

      const response = await fetch(
        `${API_URL}/api/dashboard/stats`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        console.error(
          "Dashboard API error:",
          result.message || response.status
        );
        return;
      }

      const data = result.data || {};

      setStats({
        meetings: Number(data.meetings ?? 0),
        events: Number(data.events ?? 0),
        policies: Number(data.policies ?? 0),
        documents: Number(data.documents ?? 0),
      });
    } catch (error) {
      console.error("Dashboard stats error:", error);
    }
  };

  /* =====================================
     LOGOUT
  ===================================== */

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };

  /* =====================================
     MODULE PAGES
  ===================================== */

  if (currentPage === "users" && isAdmin) {
    return (
      <div className="dashboard-page">
        <aside className="dashboard-sidebar">
          <div className="dashboard-brand">
            <div className="dashboard-logo">E</div>

            <div>
              <h2>EVENTRA</h2>
              <span>Institutional Memory</span>
            </div>
          </div>

          <nav className="dashboard-nav">
            <button
              onClick={() =>
                setCurrentPage("dashboard")
              }
            >
              <span>⌂</span>
              Dashboard
            </button>

            <button className="active">
              <span>♙</span>
              User Management
            </button>
          </nav>

          <div className="dashboard-sidebar-bottom">
            <div className="dashboard-role">
              <span>ROLE</span>
              <strong>{user?.role || "Viewer"}</strong>
            </div>

            <button
              className="dashboard-logout"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </aside>

        <main className="dashboard-main">
          <UserManagement currentUser={user} />
        </main>
      </div>
    );
  }

  if (currentPage === "meetings") {
    return (
      <Meetings
        user={user}
        onBack={() => {
          setCurrentPage("dashboard");
          fetchStats();
        }}
      />
    );
  }

  if (currentPage === "minutes") {
    return (
      <Minutes
        user={user}
        onBack={() => {
          setCurrentPage("dashboard");
          fetchStats();
        }}
      />
    );
  }

  if (currentPage === "events") {
    return (
      <Events
        user={user}
        onBack={() => {
          setCurrentPage("dashboard");
          fetchStats();
        }}
      />
    );
  }

  if (currentPage === "policies") {
    return (
      <Policies
        user={user}
        onBack={() => {
          setCurrentPage("dashboard");
          fetchStats();
        }}
      />
    );
  }

  if (currentPage === "documents") {
    return (
      <Documents
        user={user}
        onBack={() => {
          setCurrentPage("dashboard");
          fetchStats();
        }}
      />
    );
  }

  if (currentPage === "activity") {
    return (
      <ActivityLog
        user={user}
        onBack={() => {
          setCurrentPage("dashboard");
          fetchStats();
        }}
      />
    );
  }

  /* =====================================
     MAIN DASHBOARD
  ===================================== */

  return (
    <div className="dashboard-page">

      {/* SIDEBAR */}

      <aside className="dashboard-sidebar">
        <div className="dashboard-brand">
          <div className="dashboard-logo">E</div>

          <div>
            <h2>EVENTRA</h2>
            <span>Institutional Memory</span>
          </div>
        </div>

        <nav className="dashboard-nav">

          {/* DASHBOARD */}

          <button
            className={
              currentPage === "dashboard"
                ? "active"
                : ""
            }
            onClick={() =>
              setCurrentPage("dashboard")
            }
          >
            <span>⌂</span>
            Dashboard
          </button>

          {/* MEETINGS */}

          {permissions.meetings?.view && (
            <button
              className={
                currentPage === "meetings"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setCurrentPage("meetings")
              }
            >
              <span>◉</span>
              Meetings
            </button>
          )}

          {/* MINUTES */}

          <button
            className={
              currentPage === "minutes"
                ? "active"
                : ""
            }
            onClick={() =>
              setCurrentPage("minutes")
            }
          >
            <span>▤</span>
            Minutes
          </button>

          {/* EVENTS */}

          {permissions.events?.view && (
            <button
              className={
                currentPage === "events"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setCurrentPage("events")
              }
            >
              <span>◆</span>
              Events
            </button>
          )}

          {/* POLICIES */}

          {permissions.policies?.view && (
            <button
              className={
                currentPage === "policies"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setCurrentPage("policies")
              }
            >
              <span>▣</span>
              Policies
            </button>
          )}

          {/* DOCUMENTS */}

          {permissions.documents?.view && (
            <button
              className={
                currentPage === "documents"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setCurrentPage("documents")
              }
            >
              <span>▤</span>
              Documents
            </button>
          )}

          {/* ACTIVITY LOG */}

          {permissions.activity?.view && (
            <button
              className={
                currentPage === "activity"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setCurrentPage("activity")
              }
            >
              <span>◷</span>
              Activity Log
            </button>
          )}

          {/* USER MANAGEMENT */}

          {isAdmin && (
            <button
              className={
                currentPage === "users"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setCurrentPage("users")
              }
            >
              <span>♙</span>
              User Management
            </button>
          )}
        </nav>

        <div className="dashboard-sidebar-bottom">
          <div className="dashboard-role">
            <span>ROLE</span>
            <strong>{user?.role || "Viewer"}</strong>
          </div>

          <button
            className="dashboard-logout"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main className="dashboard-main">

        {/* TOPBAR */}

        <header className="dashboard-topbar">
          <div>
            <p className="dashboard-eyebrow">
              SMART INSTITUTION
            </p>

            <h1>
              Welcome back, {user?.name || "User"}
            </h1>

            <p>
              Manage institutional meetings, events, policies
              and documents from one place.
            </p>
          </div>

          <div className="dashboard-user">
            <div className="dashboard-avatar">
              {(user?.name || "U")
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>{user?.name || "User"}</strong>
              <span>{user?.email || ""}</span>
            </div>
          </div>
        </header>

        {/* STATS */}

        <section className="dashboard-stats">

          {permissions.meetings?.view && (
            <button
              className="dashboard-stat-card"
              onClick={() =>
                setCurrentPage("meetings")
              }
            >
              <span>Meetings</span>
              <strong>{stats.meetings}</strong>
              <small>Meeting records</small>
            </button>
          )}

          {permissions.events?.view && (
            <button
              className="dashboard-stat-card"
              onClick={() =>
                setCurrentPage("events")
              }
            >
              <span>Events</span>
              <strong>{stats.events}</strong>
              <small>Institutional events</small>
            </button>
          )}

          {permissions.policies?.view && (
            <button
              className="dashboard-stat-card"
              onClick={() =>
                setCurrentPage("policies")
              }
            >
              <span>Policies</span>
              <strong>{stats.policies}</strong>
              <small>Active policies</small>
            </button>
          )}

          {permissions.documents?.view && (
            <button
              className="dashboard-stat-card"
              onClick={() =>
                setCurrentPage("documents")
              }
            >
              <span>Documents</span>
              <strong>{stats.documents}</strong>
              <small>Stored documents</small>
            </button>
          )}
        </section>

        {/* WORKSPACE */}

        <section className="dashboard-workspace">
          <div className="workspace-card">
            <div>
              <span className="dashboard-section-label">
                WORKSPACE
              </span>

              <h2>
                Institutional Memory, centralized.
              </h2>

              <p>
                EVENTRA keeps meetings, events, policies and
                important documents organized in one secure
                workspace.
              </p>
            </div>

            <div className="workspace-actions">
              {permissions.meetings?.view && (
                <button
                  onClick={() =>
                    setCurrentPage("meetings")
                  }
                >
                  Open Meetings
                </button>
              )}

              {permissions.documents?.view && (
                <button
                  onClick={() =>
                    setCurrentPage("documents")
                  }
                >
                  Open Documents
                </button>
              )}
            </div>
          </div>
        </section>

        {/* BOTTOM GRID */}

        <section className="dashboard-bottom-grid">

          {/* QUICK ACCESS */}

          <div className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <span className="dashboard-section-label">
                  QUICK ACCESS
                </span>

                <h2>Core modules</h2>
              </div>
            </div>

            <div className="quick-access-grid">

              {permissions.meetings?.view && (
                <button
                  onClick={() =>
                    setCurrentPage("meetings")
                  }
                >
                  <strong>Meetings</strong>
                  <span>Manage meeting records</span>
                </button>
              )}

              <button
                onClick={() =>
                  setCurrentPage("minutes")
                }
              >
                <strong>Minutes</strong>
                <span>Prepare official minutes</span>
              </button>

              {permissions.events?.view && (
                <button
                  onClick={() =>
                    setCurrentPage("events")
                  }
                >
                  <strong>Events</strong>
                  <span>Manage institutional events</span>
                </button>
              )}

              {permissions.policies?.view && (
                <button
                  onClick={() =>
                    setCurrentPage("policies")
                  }
                >
                  <strong>Policies</strong>
                  <span>Manage policy records</span>
                </button>
              )}

              {permissions.documents?.view && (
                <button
                  onClick={() =>
                    setCurrentPage("documents")
                  }
                >
                  <strong>Documents</strong>
                  <span>Browse document archive</span>
                </button>
              )}

              {permissions.activity?.view && (
                <button
                  onClick={() =>
                    setCurrentPage("activity")
                  }
                >
                  <strong>Activity Log</strong>
                  <span>
                    View institutional audit history
                  </span>
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={() =>
                    setCurrentPage("users")
                  }
                >
                  <strong>User Management</strong>
                  <span>
                    Approve and manage account access
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* SYSTEM STATUS */}

          <div className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <span className="dashboard-section-label">
                  SYSTEM
                </span>

                <h2>EVENTRA Status</h2>
              </div>
            </div>

            <div className="system-status">
              <div className="status-dot"></div>

              <div>
                <strong>Workspace operational</strong>
                <span>
                  Modules are connected to the SmartInstitution
                  backend.
                </span>
              </div>
            </div>

            <div className="system-features">
              <span>RBAC</span>
              <span>MySQL</span>
              <span>Secure API</span>
              <span>Audit Ready</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;