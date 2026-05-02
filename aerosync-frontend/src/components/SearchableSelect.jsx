import { useState, useRef, useEffect } from "react";

/**
 * SearchableSelect — a fully custom searchable dropdown.
 *
 * Props:
 *   value        — current value (matches an option's `value` field)
 *   onChange     — called with the selected option value
 *   options      — array of { value, label, sublabel? }
 *   placeholder  — placeholder text when nothing is selected
 *   style        — additional style for the trigger button
 *   disabled     — disables the control
 */
export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select…",
  style = {},
  disabled = false,
}) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const containerRef          = useRef(null);
  const inputRef              = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const selected = options.find(o => String(o.value) === String(value));

  const filtered = query
    ? options.filter(o =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(query.toLowerCase()))
      )
    : options;

  const handleSelect = (opt) => {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
  };

  const triggerStyle = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "14px",
    boxSizing: "border-box",
    backgroundColor: disabled ? "var(--background)" : "var(--surface)",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    textAlign: "left",
    color: selected ? "var(--text-primary)" : "var(--text-secondary)",
    ...style,
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen(o => !o); setQuery(""); } }}
        style={triggerStyle}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{ fontSize: "10px", color: "var(--text-secondary)", flexShrink: 0 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          minWidth: "100%",
          zIndex: 1000,
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          boxShadow: "0 8px 24px var(--shadow-md)",
          overflow: "visible",
          color: "var(--text-primary)",
        }}>
          {/* Search input */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", backgroundColor: "var(--surface)" }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search…"
              style={{
                width: "100%",
                padding: "7px 10px",
                border: "1px solid var(--border)",
                borderRadius: "5px",
                fontSize: "13px",
                boxSizing: "border-box",
                outline: "none",
                backgroundColor: "var(--background)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {/* Options list */}
          <div style={{ maxHeight: "220px", overflowY: "auto", backgroundColor: "var(--surface)" }}>
            {/* Clear / None option */}
            <div
              onClick={() => handleSelect({ value: "", label: "" })}
              style={{
                padding: "9px 14px",
                cursor: "pointer",
                fontSize: "13px",
                color: "var(--text-secondary)",
                fontStyle: "italic",
                borderBottom: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--background)"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "var(--surface)"}
            >
              — None —
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: "14px", textAlign: "center", color: "var(--text-secondary)", fontSize: "13px", backgroundColor: "var(--surface)" }}>
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : (
              filtered.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => handleSelect(opt)}
                  style={{
                    padding: "9px 14px",
                    cursor: "pointer",
                    backgroundColor: String(opt.value) === String(value) ? "var(--background)" : "var(--surface)",
                    borderLeft: String(opt.value) === String(value) ? "3px solid var(--accent)" : "3px solid transparent",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                  onMouseEnter={e => { if (String(opt.value) !== String(value)) e.currentTarget.style.backgroundColor = "var(--background)"; }}
                  onMouseLeave={e => { if (String(opt.value) !== String(value)) e.currentTarget.style.backgroundColor = String(opt.value) === String(value) ? "var(--background)" : "var(--surface)"; }}
                >
                  <span style={{ fontSize: "14px", fontWeight: String(opt.value) === String(value) ? "700" : "400", color: "var(--text-primary)", lineHeight: "1.3" }}>
                    {opt.label}
                  </span>
                  {opt.sublabel && (
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: "1.2" }}>
                      {opt.sublabel}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
