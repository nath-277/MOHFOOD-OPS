import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import {
  findUserByIdentifier,
  findUserByPin,
  getAllUsers,
  updateUserPassword,
  updateUserPin,
} from "../../auth/store";
import {
  verifyPassword,
  signSession,
  verifySession,
  AUTH_COOKIE_NAME,
  UserSessionPayload,
} from "../../auth/session";

export const authRouter = new Hono();

// Helper to determine dashboard redirect path based on role and department
function getRedirectUrl(role: string, departmentCode: string): string {
  if (role === "SUPER_ADMIN") return "/admin";
  if (role === "EXECUTIVE" || departmentCode === "EXECUTIVE_MANAGEMENT") return "/management";
  if (role === "STORE_MANAGER" || role === "STORE_OFFICER" || departmentCode === "INVENTORY_STORE") return "/inventory";
  return "/inventory";
}

// ==========================================
// 1. CREDENTIAL LOGIN (EMAIL / STAFF ID + PASSWORD)
// ==========================================
authRouter.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return c.json({ error: "Please provide staff ID/email and password." }, 400);
    }

    const user = await findUserByIdentifier(identifier);
    if (!user) {
      return c.json({ error: "Invalid credentials. Staff account not found." }, 401);
    }

    const passwordMatches = await verifyPassword(password, user.passwordHash);
    if (!passwordMatches) {
      return c.json({ error: "Invalid password. Please check your credentials." }, 401);
    }

    const now = Date.now();
    const sessionPayload: UserSessionPayload = {
      sessionId: crypto.randomUUID(),
      userId: user.id,
      staffId: user.staffId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      departmentCode: user.departmentCode,
      activeShift: null,
      issuedAt: now,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days
    };

    const token = await signSession(sessionPayload);

    // Set secure HTTP-only session cookie
    setCookie(c, AUTH_COOKIE_NAME, token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60,
    });

    return c.json({
      success: true,
      user: {
        id: user.id,
        staffId: user.staffId,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        departmentCode: user.departmentCode,
        departmentName: user.departmentName,
      },
      redirectUrl: getRedirectUrl(user.role, user.departmentCode),
    });
  } catch (err: any) {
    console.error("Login error:", err);
    return c.json({ error: "Internal server error during authentication." }, 500);
  }
});

// ==========================================
// 2. FAST 4-DIGIT PIN SWITCH (WAREHOUSE TABLET)
// ==========================================
authRouter.post("/pin-switch", async (c) => {
  try {
    const body = await c.req.json();
    const { pin } = body;

    if (!pin || pin.length !== 4) {
      return c.json({ error: "A valid 4-digit PIN is required." }, 400);
    }

    const user = await findUserByPin(pin);
    if (!user) {
      return c.json({ error: "Unrecognized PIN. Access denied." }, 401);
    }

    const now = Date.now();
    const sessionPayload: UserSessionPayload = {
      sessionId: crypto.randomUUID(),
      userId: user.id,
      staffId: user.staffId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      departmentCode: user.departmentCode,
      activeShift: "MORNING_SHIFT",
      issuedAt: now,
      expiresAt: now + 24 * 60 * 60 * 1000, // 24 hours for quick shift PIN
    };

    const token = await signSession(sessionPayload);

    setCookie(c, AUTH_COOKIE_NAME, token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 24 * 60 * 60,
    });

    return c.json({
      success: true,
      message: `Welcome, ${user.fullName}`,
      user: {
        id: user.id,
        staffId: user.staffId,
        fullName: user.fullName,
        role: user.role,
        departmentCode: user.departmentCode,
        departmentName: user.departmentName,
      },
      redirectUrl: getRedirectUrl(user.role, user.departmentCode),
    });
  } catch (err: any) {
    console.error("PIN Switch error:", err);
    return c.json({ error: "Failed to authenticate PIN." }, 500);
  }
});

// ==========================================
// 3. CURRENT USER (GET /api/auth/me)
// ==========================================
authRouter.get("/me", async (c) => {
  const token = getCookie(c, AUTH_COOKIE_NAME);
  if (!token) {
    return c.json({ authenticated: false, user: null }, 200);
  }

  const session = await verifySession(token);
  if (!session) {
    deleteCookie(c, AUTH_COOKIE_NAME, { path: "/" });
    return c.json({ authenticated: false, user: null }, 200);
  }

  return c.json({
    authenticated: true,
    user: session,
  });
});

// ==========================================
// 4. LOGOUT
// ==========================================
authRouter.post("/logout", async (c) => {
  deleteCookie(c, AUTH_COOKIE_NAME, { path: "/" });
  return c.json({ success: true, message: "Logged out successfully." });
});

// ==========================================
// 5. DEMO ACCOUNTS DIRECTORY (For Testing & Dev)
// ==========================================
authRouter.get("/demo-accounts", async (c) => {
  if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_HIDE_DEMO_ACCOUNTS === "true") {
    return c.json({ users: [] });
  }
  const users = await getAllUsers();
  return c.json({ users });
});

// ==========================================
// 6. UPDATE PASSWORD
// ==========================================
authRouter.post("/update-password", async (c) => {
  try {
    const token = getCookie(c, AUTH_COOKIE_NAME);
    if (!token) {
      return c.json({ error: "Unauthorized. Please log in to update your password." }, 401);
    }
    const session = await verifySession(token);
    if (!session) {
      return c.json({ error: "Your session has expired. Please log in again." }, 401);
    }

    const body = await c.req.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword) {
      return c.json({ error: "Current password is required." }, 400);
    }
    if (!newPassword) {
      return c.json({ error: "New password is required." }, 400);
    }
    if (newPassword.length < 8) {
      return c.json({ error: "New password must be at least 8 characters long." }, 400);
    }
    if (newPassword !== confirmPassword) {
      return c.json({ error: "New passwords do not match. Please verify." }, 400);
    }
    if (currentPassword === newPassword) {
      return c.json({ error: "New password must be different from your current password." }, 400);
    }

    const result = await updateUserPassword(session.userId, currentPassword, newPassword);
    return c.json({ success: true, message: result.message });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update password." }, 400);
  }
});

// ==========================================
// 7. UPDATE TERMINAL PIN
// ==========================================
authRouter.post("/update-pin", async (c) => {
  try {
    const token = getCookie(c, AUTH_COOKIE_NAME);
    if (!token) {
      return c.json({ error: "Unauthorized. Please log in to update your PIN." }, 401);
    }
    const session = await verifySession(token);
    if (!session) {
      return c.json({ error: "Your session has expired. Please log in again." }, 401);
    }

    const body = await c.req.json();
    const { pin, confirmPin } = body;

    if (!pin || !/^\d{4}$/.test(pin)) {
      return c.json({ error: "PIN must be exactly 4 numeric digits." }, 400);
    }
    if (pin !== confirmPin) {
      return c.json({ error: "PINs do not match. Please re-enter." }, 400);
    }

    const result = await updateUserPin(session.userId, pin);
    return c.json({ success: true, message: result.message });
  } catch (err: any) {
    return c.json({ error: err.message || "Failed to update PIN." }, 400);
  }
});
