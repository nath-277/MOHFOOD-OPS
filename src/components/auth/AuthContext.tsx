"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTerminalLocked, setIsTerminalLocked] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const locked = sessionStorage.getItem("moh_terminal_locked") === "true";
      setIsTerminalLocked(locked);
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
      const current = window.location.pathname;
      router.push(`/pin-lock?locked=true&returnTo=${encodeURIComponent(current)}`);
    }
  }, [router]);

  const unlockTerminal = useCallback(
    async (pin: string) => {
      try {
        const res = await fetch("/api/auth/pin-switch", {
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
      setUser(null);
      setIsTerminalLocked(false);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("moh_terminal_locked");
      }
      router.push("/login");
    } catch (err) {
      console.error("Logout error:", err);
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
