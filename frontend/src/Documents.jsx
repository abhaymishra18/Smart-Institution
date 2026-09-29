import { useEffect, useState } from "react";
import "./Documents.css";
import { getPermissions } from "./permissions";

const API_URL = "http://localhost:5000";

function Documents({ user, onBack }) {
  const permissions = getPermissions(user?.role);

  const canUpload = permissions.documents?.upload;
  const canDelete = permissions.documents?.delete;

  const [documents, setDocuments] = useState([]);
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  /*
    Get JWT token from sessionStorage.
    Password is never stored here.
  */
  const getToken = () => {
    return sessionStorage.getItem(
      "smartInstitutionToken"
    );
  };

  /*
    Common authenticated headers.
  */
  const getAuthHeaders = () => {
    const token = getToken();

    return token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {};
  };

  /*
    Fetch documents
  */
  const fetchDocuments = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/documents`,
        {
          method: "GET",
          headers: {
            ...getAuthHeaders(),
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load documents."
        );
      }

      setDocuments(data.documents || []);
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  /*
    File selection
  */
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage("File size must not exceed 10 MB.");
      event.target.value = "";
      setSelectedFile(null);
      return;
    }

    setMessage("");
    setSelectedFile(file);
  };

  /*
    Upload document
  */
  const handleUpload = async (event) => {
    event.preventDefault();

    if (!canUpload) {
      setMessage(
        "You do not have permission to upload documents."
      );
      return;
    }

    if (!title.trim()) {
      setMessage("Please enter a document title.");
      return;
    }

    if (!selectedFile) {
      setMessage("Please select a file.");
      return;
    }

    const token = getToken();

    if (!token) {
      setMessage(
        "Your session has expired. Please login again."
      );
      return;
    }

    try {
      setUploading(true);
      setMessage("");

      const formData = new FormData();

      formData.append("title", title.trim());
      formData.append("file", selectedFile);

      /*
        Do NOT send uploaded_by.

        Backend gets the real user ID from JWT.
        This prevents user impersonation.
      */

      const response = await fetch(
        `${API_URL}/api/documents/upload`,
        {
          method: "POST",

          headers: {
            Authorization: `Bearer ${token}`,
          },

          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Upload failed."
        );
      }

      setTitle("");
      setSelectedFile(null);

      const fileInput =
        document.getElementById("document-file");

      if (fileInput) {
        fileInput.value = "";
      }

      setMessage(
        "Document uploaded successfully."
      );

      await fetchDocuments();
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    } finally {
      setUploading(false);
    }
  };

  /*
    SECURE DOCUMENT OPEN

    We do NOT use:
    <a href="/uploads/file.pdf">

    Instead:
    1. Send JWT
    2. Backend verifies JWT
    3. Backend returns file
    4. Create temporary browser Blob URL
    5. Open the Blob URL
  */
  const handleOpen = async (documentId) => {
    const token = getToken();

    if (!token) {
      setMessage(
        "Your session has expired. Please login again."
      );
      return;
    }

    try {
      setOpeningId(documentId);
      setMessage("");

      const response = await fetch(
        `${API_URL}/api/documents/${documentId}/download`,
        {
          method: "GET",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        let errorMessage =
          "Unable to open document.";

        try {
          const data = await response.json();

          errorMessage =
            data.message || errorMessage;
        } catch {
          // Server may return a non-JSON error.
        }

        throw new Error(errorMessage);
      }

      const blob = await response.blob();

      /*
        Temporary local browser URL.
        It does not expose the server file path.
      */
      const blobUrl =
        window.URL.createObjectURL(blob);

      const newWindow = window.open(
        blobUrl,
        "_blank",
        "noopener,noreferrer"
      );

      /*
        Some browsers may block popup.
      */
      if (!newWindow) {
        window.URL.revokeObjectURL(blobUrl);

        setMessage(
          "Please allow pop-ups to open the document."
        );

        return;
      }

      /*
        Give the new tab time to load before
        releasing the temporary URL.
      */
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
      }, 60000);
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    } finally {
      setOpeningId(null);
    }
  };

  /*
    Delete document
  */
  const handleDelete = async (id) => {
    if (!canDelete) {
      setMessage(
        "You do not have permission to delete documents."
      );
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this document?"
    );

    if (!confirmed) {
      return;
    }

    const token = getToken();

    if (!token) {
      setMessage(
        "Your session has expired. Please login again."
      );
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/documents/${id}`,
        {
          method: "DELETE",

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Delete failed."
        );
      }

      setMessage(
        "Document deleted successfully."
      );

      await fetchDocuments();
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    }
  };

  /*
    Search
  */
  const filteredDocuments = documents.filter(
    (document) => {
      const searchText =
        search.trim().toLowerCase();

      if (!searchText) {
        return true;
      }

      return (
        document.title
          ?.toLowerCase()
          .includes(searchText) ||
        document.file_name
          ?.toLowerCase()
          .includes(searchText) ||
        document.document_type
          ?.toLowerCase()
          .includes(searchText) ||
        document.file_type
          ?.toLowerCase()
          .includes(searchText)
      );
    }
  );

  /*
    Date formatting
  */
  const formatDate = (date) => {
    if (!date) {
      return "—";
    }

    return new Date(date).toLocaleString(
      "en-IN",
      {
        dateStyle: "medium",
        timeStyle: "short",
      }
    );
  };

  return (
    <div className="documents-page">
      <header className="documents-header">
        <button
          className="documents-back-button"
          onClick={onBack}
        >
          ← Dashboard
        </button>

        <div>
          <p className="documents-eyebrow">
            EVENTRA
          </p>

          <h1>Documents</h1>

          <p className="documents-subtitle">
            Centralized institutional document
            repository
          </p>
        </div>

        <div className="documents-user">
          <span>{user?.name || "User"}</span>
          <small>{user?.role || "Viewer"}</small>
        </div>
      </header>

      <main className="documents-content">
        <section className="documents-toolbar">
          <div>
            <h2>Document Repository</h2>

            <p>
              Store and retrieve important
              institutional files.
            </p>
          </div>

          <input
            type="search"
            placeholder="Search documents..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </section>

        {canUpload && (
          <section className="document-upload-card">
            <div className="upload-heading">
              <div>
                <span className="section-label">
                  ADD DOCUMENT
                </span>

                <h2>Upload a new document</h2>

                <p>
                  PDF, Word, Excel, PowerPoint and
                  text files up to 10 MB.
                </p>
              </div>
            </div>

            <form
              className="document-upload-form"
              onSubmit={handleUpload}
            >
              <input
                type="text"
                placeholder="Document title"
                value={title}
                maxLength={200}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
              />

              <input
                id="document-file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                onChange={handleFileChange}
              />

              <button
                type="submit"
                disabled={uploading}
              >
                {uploading
                  ? "Uploading..."
                  : "Upload Document"}
              </button>
            </form>
          </section>
        )}

        {message && (
          <div className="documents-message">
            {message}
          </div>
        )}

        <section className="documents-list-section">
          <div className="documents-list-heading">
            <div>
              <span className="section-label">
                ARCHIVE
              </span>

              <h2>
                {filteredDocuments.length} Documents
              </h2>
            </div>
          </div>

          {loading ? (
            <div className="documents-empty">
              Loading documents...
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="documents-empty">
              <div className="empty-icon">📁</div>

              <h3>No documents found</h3>

              <p>
                Uploaded documents will appear
                here.
              </p>
            </div>
          ) : (
            <div className="documents-grid">
              {filteredDocuments.map(
                (document) => (
                  <article
                    className="document-card"
                    key={document.id}
                  >
                    <div className="document-icon">
                      {document.document_type ===
                      "pdf"
                        ? "PDF"
                        : document.document_type?.toUpperCase() ||
                          "FILE"}
                    </div>

                    <div className="document-info">
                      <h3>
                        {document.title ||
                          document.file_name}
                      </h3>

                      <p>
                        {document.file_name}
                      </p>

                      <small>
                        Uploaded{" "}
                        {formatDate(
                          document.uploaded_at ||
                            document.created_at
                        )}
                      </small>
                    </div>

                    <div className="document-actions">
                      <button
                        type="button"
                        className="document-open-button"
                        onClick={() =>
                          handleOpen(document.id)
                        }
                        disabled={
                          openingId === document.id
                        }
                      >
                        {openingId === document.id
                          ? "Opening..."
                          : "Open"}
                      </button>

                      {canDelete && (
                        <button
                          type="button"
                          className="document-delete-button"
                          onClick={() =>
                            handleDelete(
                              document.id
                            )
                          }
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Documents;