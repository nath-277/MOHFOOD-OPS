"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

export interface AuthUser {
  userId: string;
  staffId: string;
  fullName: string;
  email: string;
  role: string;
  departmentCode: string;
  departmentName?: string;
  phone?: string;
  activeShift?: "MORNING_SHIFT" | "NIGHT_SHIFT" | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isTerminalLocked: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string; redirectUrl?: string }>;
  pinSwitch: (pin: string) => Promise<{ success: boolean; error?: string; redirectUrl?: string }>;
  lockTerminal: () => void;
  unlockTerminal: (pin: string) => Promise<{ success: boolean; error?: string; redirectUrl?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes floor idle timeout

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTerminalLocked, setIsTerminalLocked] = useState<boolean>(false);
  const router = useRouter();
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isLocked =
        sessionStorage.getItem("moh_terminal_locked") === "true" ||
        document.cookie.includes("moh_terminal_locked=true");
      setIsTerminalLocked(isLocked);
    }
  }, []);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          return;
        }
      }
      setUser(null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (identifier: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Login failed." };
      }

      await fetchCurrentUser();
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("moh_terminal_locked");
        document.cookie = "moh_terminal_locked=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        lastActivityRef.current = Date.now();
        localStorage.setItem("moh_last_active_ts", String(Date.now()));
      }
      if (data.redirectUrl) {
        router.push(data.redirectUrl);
      }
      return { success: true, redirectUrl: data.redirectUrl };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error during login." };
    }
  };

  const pinSwitch = async (pin: string) => {
    try {
      const res = await fetch("/api/auth/pin-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Invalid PIN." };
      }

      await fetchCurrentUser();
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("moh_terminal_locked");
        document.cookie = "moh_terminal_locked=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        lastActivityRef.current = Date.now();
        localStorage.setItem("moh_last_active_ts", String(Date.now()));
      }
      if (data.redirectUrl) {
        router.push(data.redirectUrl);
      }
      return { success: true, redirectUrl: data.redirectUrl };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to switch operator." };
    }
  };

  const lockTerminal = useCallback(() => {
    setIsTerminalLocked(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("moh_terminal_locked", "true");
      document.cookie = "moh_terminal_locked=true; path=/; max-age=604800; SameSite=Lax";
      const current = window.location.pathname;
      if (current !== "/pin-lock") {
        router.push(`/pin-lock?locked=true&returnTo=${encodeURIComponent(current)}`);
      }
    }
  }, [router]);

  // 5-Minute Inactivity Auto-Lock & Device Sleep / Tab Visibility Watcher
  useEffect(() => {
    if (!user || isTerminalLocked) return;

    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current > 2000) {
        lastActivityRef.current = now;
        try {
          localStorage.setItem("moh_last_active_ts", String(now));
        } catch {}
      }
    };

    const checkInactivity = () => {
      if (!user || isTerminalLocked) return;
      let lastActive = lastActivityRef.current;
      try {
        const stored = parseInt(localStorage.getItem("moh_last_active_ts") || "0", 10);
        if (stored > lastActive) lastActive = stored;
      } catch {}

      if (Date.now() - lastActive >= INACTIVITY_TIMEOUT_MS) {
        lockTerminal();
      }
    };

    const events = ["mousedown", "keydown", "touchstart", "scroll", "mousemove"];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkInactivity();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const interval = setInterval(checkInactivity, 10000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(interval);
    };
  }, [user, isTerminalLocked, lockTerminal]);

  const unlockTerminal = useCallback(
    async (pin: string) => {
      try {
        const res = await fetch("/api/auth/unlock-terminal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });

        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error || "Incorrect PIN." };
        }

        setIsTerminalLocked(false);
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("moh_terminal_locked");
          document.cookie = "moh_terminal_locked=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
          lastActivityRef.current = Date.now();
          localStorage.setItem("moh_last_active_ts", String(Date.now()));
        }
        await fetchCurrentUser();
        return { success: true, redirectUrl: data.redirectUrl };
      } catch (err: any) {
        return { success: false, error: err.message || "Failed to unlock terminal." };
      }
    },
    [fetchCurrentUser]
  );

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
      setIsTerminalLocked(false);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("moh_terminal_locked");
        localStorage.removeItem("moh_last_active_ts");
        document.cookie = "moh_terminal_locked=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
      }
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isTerminalLocked,
        login,
        pinSwitch,
        lockTerminal,
        unlockTerminal,
        logout,
        refresh: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
