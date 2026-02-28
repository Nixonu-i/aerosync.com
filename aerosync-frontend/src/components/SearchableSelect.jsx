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
    border: "1px solid #ced4da",
    borderRadius: "6px",
    fontSize: "14px",
    boxSizing: "border-box",
    backgroundColor: disabled ? "#f8f9fa" : "white",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    textAlign: "left",
    color: selected ? "#212529" : "#6c757d",
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
        <span style={{ fontSize: "10px", color: "#6c757d", flexShrink: 0 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: "white",
          border: "1px solid #ced4da",
          borderRadius: "8px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          overflow: "hidden",
          /* anchor all child text so global dark-theme color inheritance never bleeds in */
          color: "#212529",
        }}>
          {/* Search input */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #f0f0f0", backgroundColor: "white" }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search…"
              style={{
                width: "100%",
                padding: "7px 10px",
                border: "1px solid #dee2e6",
                borderRadius: "5px",
                fontSize: "13px",
                boxSizing: "border-box",
                outline: "none",
                backgroundColor: "white",
                color: "#212529",
              }}
            />
          </div>

          {/* Options list */}
          <div style={{ maxHeight: "220px", overflowY: "auto", backgroundColor: "white" }}>
            {/* Clear / None option */}
            <div
              onClick={() => handleSelect({ value: "", label: "" })}
              style={{
                padding: "9px 14px",
                cursor: "pointer",
                fontSize: "13px",
                color: "#6c757d",
                fontStyle: "italic",
                borderBottom: "1px solid #f0f0f0",
                backgroundColor: "white",
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8f9fa"}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = "white"}
            >
              — None —
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: "14px", textAlign: "center", color: "#6c757d", fontSize: "13px", backgroundColor: "white" }}>
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
                    backgroundColor: String(opt.value) === String(value) ? "#e8f0fe" : "white",
                    borderLeft: String(opt.value) === String(value) ? "3px solid #0b1220" : "3px solid transparent",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                  onMouseEnter={e => { if (String(opt.value) !== String(value)) e.currentTarget.style.backgroundColor = "#f8f9fa"; }}
                  onMouseLeave={e => { if (String(opt.value) !== String(value)) e.currentTarget.style.backgroundColor = String(opt.value) === String(value) ? "#e8f0fe" : "white"; }}
                >
                  <span style={{ fontSize: "14px", fontWeight: String(opt.value) === String(value) ? "700" : "400", color: "#212529", lineHeight: "1.3" }}>
                    {opt.label}
                  </span>
                  {opt.sublabel && (
                    <span style={{ fontSize: "11px", color: "#6c757d", lineHeight: "1.2" }}>
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
