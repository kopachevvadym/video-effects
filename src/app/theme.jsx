import { useEffect, useState } from "react";

const KEY = "gesture-flow-theme";

const systemTheme = () => (matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark");

/** "light" | "dark": saved choice, otherwise the system setting. */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const t = localStorage.getItem(KEY);
      if (t === "light" || t === "dark") return t;
    } catch {}
    return systemTheme();
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggle = () =>
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(KEY, next);
      } catch {}
      return next;
    });
  return [theme, toggle];
}
