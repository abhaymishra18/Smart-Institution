# 🏛️ Smart Institution

### Centralized Meeting, Event & Policy Record Management System
**SISTec Innovation Hackathon 4.0 · Problem Statement DT-17 · Sponsor: Sagar Group**
**Theme: Digital Transformation — Enterprise Solution**

A centralized platform for meetings, events, and policies. AI drafts minutes from audio/video, policies keep full version history with Git-style diffs, and a tamper-evident audit trail makes accreditation evidence easy to produce — everything in one searchable place.

> 🏆 Built for SISTec Innovation Hackathon 4.0 by a 4-member student team.

---

## 🎯 Problem Statement (DT-17)

> **Develop a centralized system to manage meetings, events, and policy records, improving efficiency, accountability, and knowledge retention.**

Institutions currently rely on scattered documents, emails, spreadsheets, and disconnected systems to manage meetings, events, and policies. This leads to:

- Manual, inconsistent meeting minutes
- Policies silently overwritten with no version history
- Lost event content (speeches, presentations, recordings)
- New committee members/staff with no easy way to review institutional history
- Compliance & audit headaches for admins
- Auditors/inspectors (e.g., NAAC/NBA) unable to get clean, retrievable records

**Smart Institution** solves this with one centralized, AI-assisted, version-controlled, and auditable platform.

---

## 💡 Our Solution

Smart Institution replaces manual record-keeping with a single system built around three principles:

1. **Minutes should write themselves as much as possible** — via live notes, or by uploading a meeting's audio/video for automatic transcription and AI-structured minutes.
2. **Nothing is ever silently overwritten** — every policy edit is a new, timestamped, attributed version. History is permanent and diffable, like Git.
3. **Anyone with the right access can find anything in seconds** — new committee members, faculty, admins, or auditors.

---

## 🚀 Key Features

### 🎙️ AI-Powered Meeting Minutes
- Upload a meeting's **audio or video** — the system extracts/transcribes speech and identifies speakers (diarization).
- The transcript is processed by an **LLM (Gemini API)** to generate structured Meeting Minutes: key discussions, decisions, action items, and responsibilities.
- Users review, edit, and finalize before saving — AI drafts, humans approve.

### 📜 Policy Version Control
- Every policy edit is stored as a new version — old versions are never overwritten.
- **Git-style diff view** shows exactly what changed between any two versions, and who approved each one.

### 🗂️ Event Archive
- Archive event content — speeches, presentations, recordings — so they aren't lost after the event ends.

### 🔍 Centralized, Searchable Records
- One searchable place for meetings, decisions, and policies — so committee members, faculty, and new joiners can find institutional history without digging through emails.

### 🔐 Security, Auth & Audit Trail
- **JWT-based authentication** with protected backend APIs.
- **Activity logging** (`activityLogger`, `activityLoggerMiddleware`) creates a tamper-evident audit trail of actions across the system — supporting accreditation and compliance needs (NAAC/NBA-style evidence).
- Secrets and credentials are kept out of source control via environment-based configuration.

### 🌐 Modern Web Interface
- A React + Vite frontend for interacting with all of the above.

---

## 🏗️ System Architecture

```text
                    ┌─────────────────────┐
                    │        User          │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Frontend (React +  │
                    │        Vite)         │
                    └──────────┬───────────┘
                               │
                          HTTP / REST API
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Backend (Node.js / │
                    │   Express + JWT +    │
                    │     Middleware)      │
                    └──────┬───────┬───────┘
                           │       │
                 ┌─────────┘       └──────────┐
                 ▼                            ▼
        ┌─────────────────┐          ┌───────────────────────┐
        │     MySQL        │          │   AI / Processing      │
        │ (records, policy │          │   (Python)              │
        │  versions, audit │          │  Gemini API · audio/    │
        │  logs)           │          │  video transcription &  │
        └─────────────────┘          │  speaker diarization    │
                                      └───────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React, Vite, JavaScript, HTML, CSS |
| **Backend** | Node.js, Express.js, REST APIs, JWT |
| **Database** | MySQL |
| **AI & Processing** | Python, Gemini API, audio/video transcription, speaker diarization |
| **Dev Tools** | Git, GitHub, VS Code |

---

## 📁 Project Structure

```text
Smart-Institution/
│
├── backend/
│   ├── middleware/              # Auth (JWT) & request middleware
│   ├── routes/                  # REST API endpoints
│   ├── utils/                   # Helper functions
│   ├── activityLogger.js        # Audit trail logger
│   ├── activityLoggerMiddleware.js
│   ├── db.js                    # MySQL connection
│   ├── process_meeting.py       # Audio/video → transcript → AI minutes pipeline
│   ├── diarization_test         # Speaker diarization (Python)
│   ├── server.js                # App entry point
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
│
└── .gitignore
```

---

## ⚙️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/abhaymishra18/Smart-Institution.git
cd Smart-Institution
```

### 2. Backend setup

```bash
cd backend
npm install
```

Create a `.env` file inside `backend/` (use `.env.example` as a reference):

```env
PORT=5000

DB_HOST=127.0.0.1
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=SmartInstitution

GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=your_long_random_secret
```

Start the backend:

```bash
node server.js
```

### 3. Frontend setup

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

---

## 🔐 Security Notes

Sensitive configuration is intentionally excluded from this repository. The following must **never** be committed:

- `.env` files
- API keys (Gemini, etc.)
- Database passwords
- JWT secrets
- User credentials

Use `.env.example` as a template — never replace its placeholders with real credentials and commit that file.

---

## 👥 Team & Contributions

Smart Institution was built collaboratively by a 4-member team for SISTec Innovation Hackathon 4.0.

| Member | Role | Contributions |
|---|---|---|
| **Abhay Mishra** | Team Lead | Backend development, research, drafting the full solution design, audio/video transcription feature |
| **Aman Sonare** | AI/LLM Engineer | LLM integration (Gemini API) — turning transcripts into structured, AI-generated meeting minutes |
| **Sunny Kaushik** | Database Engineer | MySQL schema design, including the versioning structure behind policy history |
| **Khilesh Verma** | Frontend / UI-UX | Frontend development and user interface/experience design |

Individual contributions represent primary areas of ownership; the solution design and integration were a collaborative team effort.

---

## 🔮 Future Scope

- Advanced role-based access control (Admin / Member / Viewer, fully enforced)
- Full-text search across meetings, policies, and events (Elasticsearch/OpenSearch)
- One-click compliance/accreditation evidence packet export (NAAC/NBA)
- Notifications for pending approvals and policy review deadlines
- Multilingual transcription support
- SSO / institutional login
- Cloud deployment & scalable microservice architecture
- Mobile application

---

## 📌 Project Status

**Development Status:** Completed Hackathon Prototype / Archived.

**Current State:** The core features for the SISTec Innovation Hackathon 4.0 (PS: DT-17) have been successfully implemented.

---

## 📄 License

This project is currently intended for educational and hackathon purposes. A formal open-source license may be added in the future.
