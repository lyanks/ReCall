import { useEffect, useRef, useState } from "react";

/** Modal dialog. Esc or a click outside = cancel. */
export function Dialog({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog card" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <h3 id="dlg-title">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef(null);
  useEffect(() => cancelRef.current?.focus(), []);
  return (
    <Dialog title={title} onClose={onCancel}>
      <p>{message}</p>
      <div className="dialog-actions">
        <button ref={cancelRef} onClick={onCancel} disabled={busy}>Скасувати</button>
        <button className={danger ? "danger" : "primary"} disabled={busy}
          onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>
          {busy ? "Зачекай…" : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

export function PromptDialog({ title, label, initial, confirmLabel, onConfirm, onCancel }) {
  const [value, setValue] = useState(initial || "");
  return (
    <Dialog title={title} onClose={onCancel}>
      <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) onConfirm(value.trim()); }}>
        <label className="field">{label}
          <input autoFocus value={value} maxLength={120} onChange={(e) => setValue(e.target.value)} />
        </label>
        <div className="dialog-actions">
          <button type="button" onClick={onCancel}>Скасувати</button>
          <button className="primary" disabled={!value.trim()}>{confirmLabel}</button>
        </div>
      </form>
    </Dialog>
  );
}
