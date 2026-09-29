import { useEffect, useState } from "react";
import Dashboard from "./Dashboard";
import "./App.css";

const API_URL = "http://localhost:5000";

function App() {
  const [loggedInUser, setLoggedInUser] = useState(null);

  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [rememberMe, setRememberMe] = useState(
    localStorage.getItem("smartInstitutionRemember") === "true"
  );

  const [form, setForm] = useState({
    name: "",
    email: localStorage.getItem("smartInstitutionEmail") || "",
    password: "",
    role: "Member",
  });

  /* =====================================================
     RESTORE LOGIN SESSION
  ===================================================== */

  useEffect(() => {
    try {
      const savedUser = sessionStorage.getItem(
        "smartInstitutionUser"
      );

      const savedToken = sessionStorage.getItem(
        "smartInstitutionToken"
      );

      if (savedUser && savedToken) {
        const user = JSON.parse(savedUser);

        if (user && user.id && user.role) {
          setLoggedInUser(user);
        } else {
          sessionStorage.removeItem("smartInstitutionUser");
          sessionStorage.removeItem("smartInstitutionToken");
        }
      }
    } catch (error) {
      console.error("Session restore error:", error);

      sessionStorage.removeItem("smartInstitutionUser");
      sessionStorage.removeItem("smartInstitutionToken");
    }
  }, []);

  /* =====================================================
     REMEMBERED EMAIL
  ===================================================== */

  useEffect(() => {
    const rememberedEmail =
      localStorage.getItem("smartInstitutionEmail");

    if (rememberedEmail) {
      setForm((previous) => ({
        ...previous,
        email: rememberedEmail,
      }));
    }
  }, []);

  /* =====================================================
     INPUT CHANGE
  ===================================================== */

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setMessage("");
  };

  /* =====================================================
     LOGIN
  ===================================================== */

  const handleLogin = async (event) => {
    event.preventDefault();

    if (!form.email.trim() || !form.password) {
      setMessageType("error");
      setMessage("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: form.email.trim(),
            password: form.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Invalid email or password."
        );
      }

      /* =================================================
         SECURITY CHECK
         ================================================= */

      if (!data.token || !data.user) {
        throw new Error(
          "Login response is incomplete. Please restart the backend."
        );
      }

      if (!data.user.id || !data.user.role) {
        throw new Error(
          "Invalid user information received from server."
        );
      }

      /* =================================================
         REMEMBER EMAIL
         ================================================= */

      if (rememberMe) {
        localStorage.setItem(
          "smartInstitutionRemember",
          "true"
        );

        localStorage.setItem(
          "smartInstitutionEmail",
          form.email.trim().toLowerCase()
        );
      } else {
        localStorage.removeItem(
          "smartInstitutionRemember"
        );

        localStorage.removeItem(
          "smartInstitutionEmail"
        );
      }

      /* =================================================
         SAVE JWT TOKEN
         ================================================= */

      sessionStorage.setItem(
        "smartInstitutionToken",
        data.token
      );

      /* =================================================
         SAVE USER
         ================================================= */

      sessionStorage.setItem(
        "smartInstitutionUser",
        JSON.stringify(data.user)
      );

      /* =================================================
         UPDATE APP STATE
         ================================================= */

      setLoggedInUser(data.user);

      /* Clear password from React state */
      setForm((previous) => ({
        ...previous,
        password: "",
      }));

    } catch (error) {
      console.error("Login error:", error);

      setMessageType("error");
      setMessage(
        error.message || "Unable to login."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     REGISTER
  ===================================================== */

  const handleRegister = async (event) => {
    event.preventDefault();

    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.password
    ) {
      setMessageType("error");
      setMessage(
        "Name, email and password are required."
      );
      return;
    }

    if (form.password.length < 8) {
      setMessageType("error");
      setMessage(
        "Password must be at least 8 characters."
      );
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: form.name.trim(),
            email: form.email.trim(),
            password: form.password,
            role: form.role,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to create account."
        );
      }

      setMessageType("success");
      setMessage(
        "Account created successfully. You can now login."
      );

      setIsRegistering(false);

      setForm((previous) => ({
        ...previous,
        password: "",
      }));

    } catch (error) {
      console.error("Register error:", error);

      setMessageType("error");
      setMessage(
        error.message || "Unable to create account."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =====================================================
     LOGOUT
  ===================================================== */

  const handleLogout = () => {
    sessionStorage.removeItem(
      "smartInstitutionUser"
    );

    sessionStorage.removeItem(
      "smartInstitutionToken"
    );

    setLoggedInUser(null);

    setForm((previous) => ({
      ...previous,
      password: "",
    }));
  };

  /* =====================================================
     DASHBOARD
  ===================================================== */

  if (loggedInUser) {
    return (
      <Dashboard
        user={loggedInUser}
        onLogout={handleLogout}
      />
    );
  }

  /* =====================================================
     LOGIN / REGISTER UI
  ===================================================== */

  return (
    <div className="auth-page">

      <div className="auth-background-glow glow-one"></div>
      <div className="auth-background-glow glow-two"></div>

      <div className="auth-container">

        {/* LEFT BRAND PANEL */}

        <div className="auth-brand-panel">

          <div className="brand-logo">
            <span className="brand-logo-mark">
              E
            </span>

            <span>EVENTRA</span>
          </div>

          <div className="brand-content">

            <p className="brand-eyebrow">
              SMART INSTITUTION PLATFORM
            </p>

            <h1>
              Institutional
              <br />
              <span>Memory, Simplified.</span>
            </h1>

            <p>
              Centralize meetings, events, policies
              and institutional records in one
              intelligent workspace.
            </p>

          </div>

          <div className="brand-features">

            <div className="brand-feature">
              <span>01</span>

              <div>
                <strong>Meetings</strong>

                <small>
                  Capture and organize records
                </small>
              </div>
            </div>

            <div className="brand-feature">
              <span>02</span>

              <div>
                <strong>Policies</strong>

                <small>
                  Version-controlled knowledge
                </small>
              </div>
            </div>

            <div className="brand-feature">
              <span>03</span>

              <div>
                <strong>Events</strong>

                <small>
                  One source of institutional truth
                </small>
              </div>
            </div>

          </div>

        </div>

        {/* AUTH CARD */}

        <div className="auth-card">

          <div className="auth-card-header">

            <div className="auth-mobile-logo">
              E
            </div>

            <p className="auth-label">
              {isRegistering
                ? "CREATE ACCOUNT"
                : "WELCOME BACK"}
            </p>

            <h2>
              {isRegistering
                ? "Create your account"
                : "Sign in to Eventra"}
            </h2>

            <p>
              {isRegistering
                ? "Set up your institutional workspace account."
                : "Access your institutional workspace."}
            </p>

          </div>

          {/* MESSAGE */}

          {message && (
            <div
              className={`auth-message ${
                messageType === "success"
                  ? "success"
                  : "error"
              }`}
            >
              {message}
            </div>
          )}

          {/* FORM */}

          <form
            className="auth-form"
            onSubmit={
              isRegistering
                ? handleRegister
                : handleLogin
            }
          >

            {isRegistering && (
              <div className="auth-field">

                <label htmlFor="name">
                  Full Name
                </label>

                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  maxLength={100}
                  autoComplete="name"
                  required
                />

              </div>
            )}

            <div className="auth-field">

              <label htmlFor="email">
                Email Address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />

            </div>

            <div className="auth-field">

              <label htmlFor="password">
                Password
              </label>

              <input
                id="password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Enter your password"
                autoComplete={
                  isRegistering
                    ? "new-password"
                    : "current-password"
                }
                minLength={8}
                required
              />

            </div>

            {isRegistering && (
              <div className="auth-field">

                <label htmlFor="role">
                  Account Type
                </label>

                <select
                  id="role"
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                >
                  <option value="Member">
                    Member
                  </option>

                  <option value="Viewer">
                    Viewer
                  </option>
                </select>

              </div>
            )}

            {/* REMEMBER ME */}

            {!isRegistering && (
              <div className="auth-options">

                <label className="remember-option">

                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) =>
                      setRememberMe(
                        event.target.checked
                      )
                    }
                  />

                  <span className="custom-checkbox"></span>

                  <span>
                    Remember my email
                  </span>

                </label>

                <button
                  type="button"
                  className="forgot-btn"
                  onClick={() => {
                    setMessageType("success");

                    setMessage(
                      "Password recovery will be available in a future update."
                    );
                  }}
                >
                  Forgot password?
                </button>

              </div>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : isRegistering
                  ? "Create Account"
                  : "Sign In"}
            </button>

          </form>

          {/* SWITCH */}

          <div className="auth-switch">

            <span>
              {isRegistering
                ? "Already have an account?"
                : "Don't have an account?"}
            </span>

            <button
              type="button"
              onClick={() => {
                setIsRegistering(
                  !isRegistering
                );

                setMessage("");
              }}
            >
              {isRegistering
                ? "Sign in"
                : "Create account"}
            </button>

          </div>

          <div className="auth-security-note">
            <span>◆</span>
            Secure institutional workspace
          </div>

        </div>

      </div>

    </div>
  );
}

export default App;