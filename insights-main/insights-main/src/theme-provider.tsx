import { createContext, useContext, type ReactNode } from "react";

type Ctx = { theme: "light"; toggle: () => void; setTheme: (t: "light") => void };

const ThemeContext = createContext<Ctx>({ theme: "light", toggle: () => {}, setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Locked to light theme.
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("dark");
    try {
      localStorage.setItem("lumen-theme", "light");
    } catch {}
  }
  return (
    <ThemeContext.Provider value={{ theme: "light", toggle: () => {}, setTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
