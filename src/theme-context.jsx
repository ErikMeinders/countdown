import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { themeFor } from "./theme.js";

// mode is the user's choice: "auto" follows the OS, "light"/"dark" pin it.
// scheme is what that resolves to right now.
const ThemeContext = createContext({
  T: themeFor("dark"),
  mode: "auto",
  scheme: "dark",
  setMode: () => {},
});

const STORAGE_KEY = "countdown-theme";
const MODES = ["auto", "light", "dark"];

function readMode() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(v) ? v : "auto";
  } catch {
    return "auto";
  }
}

function systemScheme() {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(readMode);
  const [system, setSystem] = useState(systemScheme);

  // Track the OS setting only while on auto.
  useEffect(() => {
    if (mode !== "auto") return;
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!mq) return;
    const onChange = () => setSystem(mq.matches ? "light" : "dark");
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [mode]);

  const scheme = mode === "auto" ? system : mode;

  const setMode = (m) => {
    setModeState(m);
    try { localStorage.setItem(STORAGE_KEY, m); } catch { /* private mode */ }
  };

  // Keep the browser chrome and the page behind the app (visible on overscroll
  // and before React mounts) in step with the theme.
  useEffect(() => {
    const bg = themeFor(scheme).bg;
    document.documentElement.style.colorScheme = scheme;
    document.body.style.background = bg;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", bg);
  }, [scheme]);

  const value = useMemo(
    () => ({ T: themeFor(scheme), mode, scheme, setMode }),
    [scheme, mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// The active palette — what components style against.
export function useTheme() {
  return useContext(ThemeContext).T;
}

// The mode control, for the toggle.
export function useThemeControls() {
  const { mode, scheme, setMode } = useContext(ThemeContext);
  return { mode, scheme, setMode };
}
