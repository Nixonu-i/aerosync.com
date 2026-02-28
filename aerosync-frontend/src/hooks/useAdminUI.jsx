import { useState, useCallback } from "react";

/**
 * useAdminUI — provides custom confirm dialogs and toast notifications
 * Usage:
 *   const { confirm, notify, ModalUI } = useAdminUI();
 *   const ok = await confirm("Delete this item?");
 *   if (!ok) return;
 *   notify("Deleted successfully", "success");
 *
 * Place {ModalUI} anywhere inside the component's return JSX.
 */
export function useAdminUI() {
  const [confirmState, setConfirmState] = useState(null);
  const [toast, setToast] = useState(null);

  const confirm = useCallback((message, { confirmText = "Confirm", danger = true } = {}) => {
    return new Promise((resolve) => {
      setConfirmState({ message, confirmText, danger, resolve });
    });
  }, []);

  const notify = useCallback((message, type = "error") => {
    const id = Date.now();
    setToast({ message, type, id });
    setTimeout(() => setToast(t => (t?.id === id ? null : t)), 4500);
  }, []);

  const handleResult = (result) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  const ModalUI = (
    <>
      {/* ── Confirm Dialog ── */}
      {confirmState && (
        <div
          onClick={() => handleResult(false)}
          style={{
            position: "fixed", inset: 0,
            backgroundColor: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#0f1a2e",
              border: "1px solid #d4af37",
              borderRadius: "12px",
              padding: "32px 36px",
              maxWidth: "420px",
              width: "90%",
              boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
            }}
          >
            {/* Icon */}
            <div style={{ textAlign: "center", marginBottom: "16px", fontSize: "36px" }}>
              {confirmState.danger ? "⚠️" : "ℹ️"}
            </div>
            {/* Message */}
            <p style={{
              color: "#e8eaf0", fontSize: "15px", lineHeight: 1.6,
              textAlign: "center", margin: "0 0 28px",
            }}>
              {confirmState.message}
            </p>
            {/* Buttons */}
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => handleResult(false)}
                style={{
                  padding: "10px 26px", borderRadius: "7px",
                  border: "1px solid #4a5568", background: "transparent",
                  color: "#a0aec0", cursor: "pointer", fontSize: "14px",
                  fontWeight: "600", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.target.style.background = "#2d3748"; e.target.style.color = "#fff"; }}
                onMouseLeave={e => { e.target.style.background = "transparent"; e.target.style.color = "#a0aec0"; }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleResult(true)}
                style={{
                  padding: "10px 26px", borderRadius: "7px",
                  border: "none",
                  background: confirmState.danger ? "#dc3545" : "#28a745",
                  color: "#fff", cursor: "pointer", fontSize: "14px",
                  fontWeight: "700", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.target.style.opacity = "0.88"; }}
                onMouseLeave={e => { e.target.style.opacity = "1"; }}
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notification ── */}
      {toast && (
        <div
          style={{
            position: "fixed", bottom: "28px", right: "28px", zIndex: 10000,
            background:
              toast.type === "success" ? "#1a3d2a" :
              toast.type === "info"    ? "#0f2040" : "#3d1a1a",
            border: `1px solid ${
              toast.type === "success" ? "#28a745" :
              toast.type === "info"    ? "#17a2b8" : "#dc3545"
            }`,
            color: "#fff",
            padding: "14px 20px",
            borderRadius: "10px",
            maxWidth: "360px",
            minWidth: "220px",
            boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
            fontSize: "14px",
            lineHeight: "1.5",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "18px", flexShrink: 0 }}>
            {toast.type === "success" ? "✓" : toast.type === "info" ? "ℹ" : "✕"}
          </span>
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{
              marginLeft: "auto", background: "none", border: "none",
              color: "rgba(255,255,255,0.6)", cursor: "pointer",
              fontSize: "16px", padding: "0 0 0 8px", flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );

  return { confirm, notify, ModalUI };
}
