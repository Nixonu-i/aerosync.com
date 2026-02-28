import { useState, useEffect, useMemo } from "react";

/**
 * DateOfBirthPicker  (also used as a general date picker)
 * Three-dropdown (Day / Month / Year) date selector.
 *
 * Props:
 *  value        – YYYY-MM-DD string (controlled)
 *  onChange     – (YYYY-MM-DD) => void  (fired when all 3 parts are selected)
 *  disabled     – boolean
 *  theme        – "light" (default) | "dark"
 *  wrapperStyle – extra styles on the outer wrapper div
 *  minYear      – earliest selectable year (default: 1920 for DOB use)
 *  maxYear      – latest selectable year  (default: current year)
 *  yearOrder    – "desc" (default, newest first — best for DOB)
 *               | "asc"  (oldest first — best for future date pickers)
 */

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function daysInMonth(month, year) {
  if (!month) return 31;
  const m = parseInt(month, 10);
  const y = year ? parseInt(year, 10) : 2000; // use leap-safe default
  return new Date(y, m, 0).getDate();          // day 0 of month+1 = last day of month
}

function fromValue(v) {
  if (!v) return { y: "", m: "", d: "" };
  const [y = "", m = "", d = ""] = v.split("-");
  return { y, m, d };
}

export default function DateOfBirthPicker({
  value = "",
  onChange,
  disabled = false,
  theme = "light",
  wrapperStyle = {},
  minYear,          // default: 1920
  maxYear,          // default: current year
  yearOrder = "desc", // "desc" for DOB | "asc" for future dates
}) {
  const currentYear = new Date().getFullYear();
  const resolvedMin = minYear ?? 1920;
  const resolvedMax = maxYear ?? currentYear;
  const [sel, setSel] = useState(() => fromValue(value));

  // Sync internal state when the controlled value changes (e.g. profile load)
  useEffect(() => {
    setSel(fromValue(value));
  }, [value]);

  const maxDays = useMemo(() => daysInMonth(sel.m, sel.y), [sel.m, sel.y]);

  const yearList = useMemo(() => {
    const count = resolvedMax - resolvedMin + 1;
    const asc = Array.from({ length: count }, (_, i) => resolvedMin + i);
    return yearOrder === "asc" ? asc : [...asc].reverse();
  }, [resolvedMin, resolvedMax, yearOrder]);

  const dayList = useMemo(
    () => Array.from({ length: maxDays }, (_, i) => String(i + 1).padStart(2, "0")),
    [maxDays]
  );

  const emit = (y, m, d) => {
    if (y && m && d) {
      onChange(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    }
  };

  const changeDay = (d) => {
    const next = { ...sel, d };
    setSel(next);
    emit(next.y, next.m, d);
  };

  const changeMonth = (m) => {
    // Clamp day if the new month has fewer days
    const newMax = daysInMonth(m, sel.y);
    const d = sel.d && parseInt(sel.d, 10) > newMax
      ? String(newMax).padStart(2, "0")
      : sel.d;
    const next = { ...sel, m, d };
    setSel(next);
    emit(next.y, m, d);
  };

  const changeYear = (y) => {
    // Re-clamp day for Feb in leap/non-leap year
    const newMax = daysInMonth(sel.m, y);
    const d = sel.d && parseInt(sel.d, 10) > newMax
      ? String(newMax).padStart(2, "0")
      : sel.d;
    const next = { ...sel, y, d };
    setSel(next);
    emit(y, next.m, d);
  };

  /* ── Styles ─────────────────────────────────────────────── */
  const isLight = theme === "light";

  const base = isLight
    ? {
        padding: "10px 6px",
        border: "1px solid #ced4da",
        borderRadius: "6px",
        fontSize: "14px",
        backgroundColor: disabled ? "#f8f9fa" : "white",
        color: "#212529",
        cursor: disabled ? "not-allowed" : "pointer",
        outline: "none",
        minWidth: 0,
      }
    : {
        padding: "9px 6px",
        borderRadius: "7px",
        border: "1px solid rgba(255,255,255,0.15)",
        background: disabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.07)",
        color: disabled ? "rgba(255,255,255,0.35)" : "#fff",
        fontSize: "14px",
        outline: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        minWidth: 0,
      };

  const optBg = isLight ? {} : { background: "#0b1a2e" };

  return (
    <div style={{ display: "flex", gap: "8px", ...wrapperStyle }}>
      {/* ── Day ── */}
      <select
        value={sel.d}
        disabled={disabled}
        onChange={(e) => changeDay(e.target.value)}
        style={{ ...base, flex: 1 }}
        aria-label="Day"
      >
        <option value="" style={optBg}>Day</option>
        {dayList.map((d) => (
          <option key={d} value={d} style={optBg}>{d}</option>
        ))}
      </select>

      {/* ── Month ── */}
      <select
        value={sel.m}
        disabled={disabled}
        onChange={(e) => changeMonth(e.target.value)}
        style={{ ...base, flex: 1.7 }}
        aria-label="Month"
      >
        <option value="" style={optBg}>Month</option>
        {MONTHS.map((name, i) => {
          const mv = String(i + 1).padStart(2, "0");
          return <option key={mv} value={mv} style={optBg}>{name}</option>;
        })}
      </select>

      {/* ── Year ── */}
      <select
        value={sel.y}
        disabled={disabled}
        onChange={(e) => changeYear(e.target.value)}
        style={{ ...base, flex: 1.4 }}
        aria-label="Year"
      >
        <option value="" style={optBg}>Year</option>
        {yearList.map((y) => (
          <option key={y} value={String(y)} style={optBg}>{y}</option>
        ))}
      </select>
    </div>
  );
}
