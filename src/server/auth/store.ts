import { db, schema } from "../db";
import { eq, or, and, ne } from "drizzle-orm";
import { hashPassword, hashPin, verifyPassword, verifyPin } from "./session";

export interface SystemUser {
  id: string;
  staffId: string;
  fullName: string;
  email: string;
  passwordHash: string;
  departmentCode: string;
  departmentName: string;
  role: string;
  pinHash: string;
  phone?: string;
  isActive: boolean;
}

export const ALLOWED_ROLES = [
  "SUPER_ADMIN",
  "EXECUTIVE",
  "STORE_MANAGER",
  "PRODUCTION_SUPERVISOR",
  "LOGISTICS_OFFICER",
  "ACCOUNTANT",
  "STAFF",
] as const;

// Fallback in-memory store for local sandbox when NeonDB connection string is pending
const DEMO_USERS: SystemUser[] = [
  {
    id: "usr_admin_001",
    staffId: "MOH-ADM-01",
    fullName: "Chief IT Systems Admin",
    email: "admin@mohfood.com",
    passwordHash: "sha256:admin:mock", // Checked via verifyPassword fallback
    pinHash: "",
    departmentCode: "EXECUTIVE_MANAGEMENT",
    departmentName: "Executive & IT Management",
    role: "SUPER_ADMIN",
    phone: "+2347010731559",
    isActive: true,
  },
  {
    id: "usr_exec_002",
    staffId: "MOH-EXEC-01",
    fullName: "Jeremiah UMOH (Executive)",
    email: "ceo@mohfood.com",
    passwordHash: "sha256:ceo:mock",
    pinHash: "",
    departmentCode: "EXECUTIVE_MANAGEMENT",
    departmentName: "Executive Management",
    role: "EXECUTIVE",
    phone: "+2347010731559",
    isActive: true,
  },
  {
    id: "usr_store_mgr_003",
    staffId: "MOH-STR-01",
    fullName: "Ajayi Boluwatife (Store Manager)",
    email: "store.manager@mohfood.com",
    passwordHash: "sha256:strmgr:mock",
    pinHash: "",
    departmentCode: "INVENTORY_STORE",
    departmentName: "Inventory Store Department",
    role: "STORE_MANAGER",
    phone: "+2348023456789",
    isActive: true,
  },
  {
    id: "usr_prod_005",
    staffId: "MOH-PRD-01",
    fullName: "David Adeleke (Production Supervisor)",
    email: "production@mohfood.com",
    passwordHash: "sha256:prod:mock",
    pinHash: "",
    departmentCode: "PRODUCTION",
    departmentName: "Production Department",
    role: "PRODUCTION_SUPERVISOR",
    phone: "+2348045678901",
    isActive: true,
  },
  {
    id: "usr_log_006",
    staffId: "MOH-LOG-01",
    fullName: "Sunday Balogun (Logistics Officer)",
    email: "logistics@mohfood.com",
    passwordHash: "sha256:log:mock",
    pinHash: "",
    departmentCode: "LOGISTICS",
    departmentName: "Logistics & Fleet Department",
    role: "LOGISTICS_OFFICER",
    phone: "+2348021194488",
    isActive: true,
  },
  {
    id: "usr_acct_007",
    staffId: "MOH-ACC-01",
    fullName: "Chioma Okeke (Accountant)",
    email: "accountant@mohfood.com",
    passwordHash: "sha256:acct:mock",
    pinHash: "",
    departmentCode: "ACCOUNTING",
    departmentName: "Accounting & Finance Department",
    role: "ACCOUNTANT",
    phone: "+2348039988776",
    isActive: true,
  },
];

// Initialise PIN and Password hashes
let initialized = false;
async function initializeStore() {
  if (initialized) return;
  const defaultPw = "ChangeThisSecurePassword123!";
  for (const u of DEMO_USERS) {
    u.passwordHash = await hashPassword(defaultPw);
  }
  if (DEMO_USERS[0]) DEMO_USERS[0].pinHash = await hashPin("1234");
  if (DEMO_USERS[1]) DEMO_USERS[1].pinHash = await hashPin("5678");
  if (DEMO_USERS[2]) DEMO_USERS[2].pinHash = await hashPin("1111");
  if (DEMO_USERS[3]) DEMO_USERS[3].pinHash = await hashPin("3333");
  if (DEMO_USERS[4]) DEMO_USERS[4].pinHash = await hashPin("4444");
  if (DEMO_USERS[5]) DEMO_USERS[5].pinHash = await hashPin("6666");
  initialized = true;
}

export async function findUserByIdentifier(identifier: string): Promise<SystemUser | null> {
  await initializeStore();
  const trimmed = identifier.trim().toLowerCase();
  const upper = identifier.trim().toUpperCase();

  // If live NeonDB is connected, query database
  if (db) {
    try {
      const result = await db.query.users.findFirst({
        where: (u, { or, eq }) => or(
          eq(u.email, trimmed),
          eq(u.staffId, upper),
          eq(u.staffId, trimmed),
          eq(u.staffId, identifier.trim())
        ),
        with: {
          department: true,
          pin: true,
        },
      });

      if (result && result.isActive) {
        return {
          id: result.id,
          staffId: result.staffId,
          fullName: result.fullName,
          email: result.email,
          passwordHash: result.passwordHash,
          departmentCode: (result.department?.code as string) || "INVENTORY_STORE",
          departmentName: result.department?.name || "Inventory Store",
          role: result.role === "STORE_OFFICER" ? "STORE_MANAGER" : result.role,
          pinHash: result.pin?.pinHash || "",
          phone: result.phone || undefined,
          isActive: result.isActive,
        };
      }
      return null;
    } catch (err) {
      console.warn("NeonDB query failed in findUserByIdentifier:", err);
      return null;
    }
  }

  // Fallback to local store strictly for offline sandbox when db is null
  const found = DEMO_USERS.find(
    (u) => u.email.toLowerCase() === trimmed || u.staffId.toLowerCase() === trimmed
  );

  return found || null;
}

export async function findUserByPin(pin: string): Promise<SystemUser | null> {
  await initializeStore();

  if (db) {
    try {
      const allUsers = await db.query.users.findMany({
        where: (u, { eq }) => eq(u.isActive, true),
        with: { department: true, pin: true },
      });
      for (const u of allUsers) {
        if (u.pin?.pinHash && (await verifyPin(pin, u.pin.pinHash))) {
          return {
            id: u.id,
            staffId: u.staffId,
            fullName: u.fullName,
            email: u.email,
            passwordHash: u.passwordHash,
            departmentCode: (u.department?.code as string) || "INVENTORY_STORE",
            departmentName: u.department?.name || "Inventory Store",
            role: u.role === "STORE_OFFICER" ? "STORE_MANAGER" : u.role,
            pinHash: u.pin.pinHash,
            phone: u.phone || undefined,
            isActive: u.isActive,
          };
        }
      }
      return null;
    } catch (err) {
      console.warn("NeonDB findUserByPin failed:", err);
      return null;
    }
  }

  for (const user of DEMO_USERS) {
    if (user.pinHash && (await verifyPin(pin, user.pinHash))) {
      return user;
    }
  }

  return null;
}

export async function getAllUsers(includeInactive = false): Promise<Omit<SystemUser, "passwordHash" | "pinHash">[]> {
  await initializeStore();

  if (db) {
    try {
      const results = await db.query.users.findMany({
        where: includeInactive ? undefined : (u, { eq }) => eq(u.isActive, true),
        with: { department: true },
      });
      return (results || []).map((u) => ({
        id: u.id,
        staffId: u.staffId,
        fullName: u.fullName,
        email: u.email,
        departmentCode: (u.department?.code as string) || "INVENTORY_STORE",
        departmentName: u.department?.name || "Inventory Store",
        role: u.role === "STORE_OFFICER" ? "STORE_MANAGER" : u.role,
        phone: u.phone || undefined,
        isActive: u.isActive,
      }));
    } catch (err) {
      console.warn("NeonDB getAllUsers failed:", err);
      return [];
    }
  }

  const list = includeInactive ? DEMO_USERS : DEMO_USERS.filter((u) => u.isActive);
  return list.map(({ passwordHash, pinHash, ...safe }) => safe);
}

export async function createStaffAccount(data: {
  staffId: string;
  fullName: string;
  email: string;
  password?: string;
  role: string;
  departmentCode: string;
  phone?: string;
  pin?: string;
}): Promise<Omit<SystemUser, "passwordHash" | "pinHash">> {
  await initializeStore();

  const staffIdUpper = data.staffId.trim().toUpperCase();
  const emailLower = data.email.trim().toLowerCase();
  const fullName = data.fullName.trim();
  const rawPassword = data.password?.trim() || "ChangeThisSecurePassword123!";
  const rawPin = data.pin?.trim();

  // Validate email format
  if (!emailLower.includes("@")) {
    throw new Error("Invalid email address format.");
  }

  // Validate role
  const role = (ALLOWED_ROLES as readonly string[]).includes(data.role) ? data.role : "STAFF";

  if (db) {
    try {
      // Check existing user
      const existing = await db.select().from(schema.users).where(
        or(eq(schema.users.email, emailLower), eq(schema.users.staffId, staffIdUpper))
      ).limit(1);

      if (existing.length > 0) {
        if (existing[0].email.toLowerCase() === emailLower) {
          throw new Error(`User with email "${emailLower}" already exists.`);
        }
        throw new Error(`Staff ID "${staffIdUpper}" is already assigned to another user.`);
      }

      // Resolve department
      let departmentId: string | undefined = undefined;
      let departmentName = "Operations";
      const deptRows = await db.select().from(schema.departments).where(
        eq(schema.departments.code, data.departmentCode as any)
      ).limit(1);

      if (deptRows.length > 0) {
        departmentId = deptRows[0].id;
        departmentName = deptRows[0].name;
      }

      // Hash password with WebCrypto SHA-256
      const passwordHash = await hashPassword(rawPassword);

      // Insert User
      const [createdUser] = await db.insert(schema.users).values({
        staffId: staffIdUpper,
        fullName,
        email: emailLower,
        passwordHash,
        departmentId,
        role: role as any,
        phone: data.phone?.trim() || null,
        isActive: true,
      }).returning();

      // If PIN is provided and valid (4 digits), hash and store PIN
      let pinHash = "";
      if (rawPin && /^\d{4}$/.test(rawPin)) {
        pinHash = await hashPin(rawPin);
        await db.insert(schema.userPins).values({
          userId: createdUser.id,
          pinHash,
        });
      }

      const safeUser: Omit<SystemUser, "passwordHash" | "pinHash"> = {
        id: createdUser.id,
        staffId: createdUser.staffId,
        fullName: createdUser.fullName,
        email: createdUser.email,
        departmentCode: data.departmentCode,
        departmentName,
        role: createdUser.role,
        phone: createdUser.phone || undefined,
        isActive: createdUser.isActive,
      };

      return safeUser;
    } catch (err: any) {
      if (err.message && (err.message.includes("already exists") || err.message.includes("already assigned"))) {
        throw err;
      }
      console.error("DB error in createStaffAccount:", err);
      throw new Error(err.message || "Failed to create staff account in database.");
    }
  }

  // Fallback in-memory strictly for offline sandbox when db is null
  const existingMemory = DEMO_USERS.find(
    (u) => u.email.toLowerCase() === emailLower || u.staffId.toUpperCase() === staffIdUpper
  );
  if (existingMemory) {
    throw new Error(`Staff with email "${emailLower}" or Staff ID "${staffIdUpper}" already exists.`);
  }

  const passwordHash = await hashPassword(rawPassword);
  const pinHash = rawPin && /^\d{4}$/.test(rawPin) ? await hashPin(rawPin) : "";

  const memoryUser: SystemUser = {
    id: `usr_${Date.now()}`,
    staffId: staffIdUpper,
    fullName,
    email: emailLower,
    passwordHash,
    departmentCode: data.departmentCode,
    departmentName: "Operations",
    role,
    pinHash,
    phone: data.phone?.trim() || undefined,
    isActive: true,
  };

  DEMO_USERS.unshift(memoryUser);
  const { passwordHash: _p, pinHash: _pin, ...safe } = memoryUser;
  return safe;
}

export async function updateStaffStatus(userId: string, isActive: boolean): Promise<boolean> {
  if (db) {
    try {
      await db.update(schema.users).set({ isActive, updatedAt: new Date() }).where(eq(schema.users.id, userId));
      return true;
    } catch (err) {
      console.error("DB error in updateStaffStatus:", err);
      return false;
    }
  }
  const memUser = DEMO_USERS.find((u) => u.id === userId);
  if (memUser) {
    memUser.isActive = isActive;
  }
  return true;
}

export interface UpdateStaffInput {
  fullName?: string;
  email?: string;
  phone?: string;
  role?: string;
  departmentCode?: string;
  password?: string;
  pin?: string;
  isActive?: boolean;
}

export async function updateStaffAccount(
  userId: string,
  data: UpdateStaffInput
): Promise<Omit<SystemUser, "passwordHash" | "pinHash">> {
  await initializeStore();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

  if (db) {
    try {
      // Find existing user
      const existingRows = await db
        .select()
        .from(schema.users)
        .where(isUuid ? eq(schema.users.id, userId) : or(eq(schema.users.staffId, userId), eq(schema.users.email, userId.toLowerCase())))
        .limit(1);

      if (existingRows.length === 0) {
        throw new Error("Staff account not found.");
      }
      const existingUser = existingRows[0];

      // If email changed, check uniqueness
      if (data.email) {
        const emailLower = data.email.trim().toLowerCase();
        if (emailLower !== existingUser.email.toLowerCase()) {
          const duplicate = await db
            .select()
            .from(schema.users)
            .where(and(eq(schema.users.email, emailLower), ne(schema.users.id, existingUser.id)))
            .limit(1);
          if (duplicate.length > 0) {
            throw new Error(`User with email "${emailLower}" already exists.`);
          }
        }
      }

      // Build update payload for schema.users
      const updatePayload: any = { updatedAt: new Date() };
      if (data.fullName) updatePayload.fullName = data.fullName.trim();
      if (data.email) updatePayload.email = data.email.trim().toLowerCase();
      if (data.phone !== undefined) updatePayload.phone = data.phone ? data.phone.trim() : null;
      if (data.role) updatePayload.role = data.role as any;
      if (data.isActive !== undefined) updatePayload.isActive = Boolean(data.isActive);

      let departmentName = "Operations";
      if (data.departmentCode) {
        const deptRows = await db
          .select()
          .from(schema.departments)
          .where(eq(schema.departments.code, data.departmentCode as any))
          .limit(1);
        if (deptRows.length > 0) {
          updatePayload.departmentId = deptRows[0].id;
          departmentName = deptRows[0].name;
        }
      }

      if (data.password && data.password.trim().length > 0) {
        updatePayload.passwordHash = await hashPassword(data.password.trim());
      }

      // Perform update on user
      const [updatedUser] = await db
        .update(schema.users)
        .set(updatePayload)
        .where(eq(schema.users.id, existingUser.id))
        .returning();

      // If PIN is provided (4 digits), update or insert in userPins
      if (data.pin && /^\d{4}$/.test(data.pin)) {
        const pinHash = await hashPin(data.pin);
        const existingPin = await db
          .select()
          .from(schema.userPins)
          .where(eq(schema.userPins.userId, existingUser.id))
          .limit(1);

        if (existingPin.length > 0) {
          await db
            .update(schema.userPins)
            .set({ pinHash, updatedAt: new Date() })
            .where(eq(schema.userPins.userId, existingUser.id));
        } else {
          await db.insert(schema.userPins).values({
            userId: existingUser.id,
            pinHash,
          });
        }
      }

      return {
        id: updatedUser.id,
        staffId: updatedUser.staffId,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        departmentCode: data.departmentCode || "INVENTORY_STORE",
        departmentName,
        role: updatedUser.role,
        phone: updatedUser.phone || undefined,
        isActive: updatedUser.isActive,
      };
    } catch (err: any) {
      if (err.message && err.message.includes("already exists")) {
        throw err;
      }
      console.error("DB error in updateStaffAccount:", err);
      throw new Error(err.message || "Failed to update staff account in database.");
    }
  }

  // Memory fallback
  const memUser = DEMO_USERS.find((u) => u.id === userId || u.staffId === userId || u.email === userId.toLowerCase());
  if (!memUser) throw new Error("Staff account not found.");

  if (data.fullName) memUser.fullName = data.fullName.trim();
  if (data.email) memUser.email = data.email.trim().toLowerCase();
  if (data.phone !== undefined) memUser.phone = data.phone ? data.phone.trim() : undefined;
  if (data.role) memUser.role = data.role;
  if (data.departmentCode) memUser.departmentCode = data.departmentCode;
  if (data.isActive !== undefined) memUser.isActive = Boolean(data.isActive);
  if (data.password) memUser.passwordHash = await hashPassword(data.password);
  if (data.pin && /^\d{4}$/.test(data.pin)) memUser.pinHash = await hashPin(data.pin);

  const { passwordHash: _p, pinHash: _pin, ...safe } = memUser;
  return safe;
}

export async function deleteStaffAccount(
  userId: string,
  options?: { permanent?: boolean }
): Promise<boolean> {
  const isPermanent = Boolean(options?.permanent);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

  if (db) {
    try {
      const existingRows = await db
        .select()
        .from(schema.users)
        .where(isUuid ? eq(schema.users.id, userId) : or(eq(schema.users.staffId, userId), eq(schema.users.email, userId.toLowerCase())))
        .limit(1);

      if (existingRows.length === 0) {
        return false;
      }
      const targetUserId = existingRows[0].id;

      if (isPermanent) {
        // Safe FK unlinking so historical audit logs / transactions preserve performedByName but nullify FK
        await db
          .update(schema.stockTransactions)
          .set({ performedBy: null })
          .where(eq(schema.stockTransactions.performedBy, targetUserId));

        await db
          .update(schema.shiftRecords)
          .set({ openedBy: null })
          .where(eq(schema.shiftRecords.openedBy, targetUserId));

        await db
          .update(schema.shiftRecords)
          .set({ closedBy: null })
          .where(eq(schema.shiftRecords.closedBy, targetUserId));

        await db
          .update(schema.productionShiftLogs)
          .set({ supervisorId: null })
          .where(eq(schema.productionShiftLogs.supervisorId, targetUserId));

        // Delete userPins
        await db.delete(schema.userPins).where(eq(schema.userPins.userId, targetUserId));

        // Delete user row permanently
        await db.delete(schema.users).where(eq(schema.users.id, targetUserId));
        return true;
      } else {
        await db
          .update(schema.users)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(schema.users.id, targetUserId));
        return true;
      }
    } catch (err: any) {
      console.error("DB error in deleteStaffAccount:", err);
      throw new Error(err?.message || "Failed to delete staff account.");
    }
  }

  // Memory fallback
  const idx = DEMO_USERS.findIndex((u) => u.id === userId || u.staffId === userId || u.email === userId.toLowerCase());
  if (idx !== -1) {
    if (isPermanent) {
      DEMO_USERS.splice(idx, 1);
    } else {
      DEMO_USERS[idx].isActive = false;
    }
  }
  return true;
}

export async function updateUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  await initializeStore();

  let userPasswordHash: string | null = null;
  let dbUserId: string | null = null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

  if (db) {
    try {
      const user = await db.query.users.findFirst({
        where: (u, { eq, or }) => (isUuid ? eq(u.id, userId) : or(eq(u.staffId, userId), eq(u.email, userId.toLowerCase()))),
      });
      if (user) {
        userPasswordHash = user.passwordHash;
        dbUserId = user.id;
      }
    } catch (err) {
      console.warn("DB query in updateUserPassword failed:", err);
    }
  } else {
    const memUser = DEMO_USERS.find(
      (u) => u.id === userId || u.staffId.toLowerCase() === userId.toLowerCase() || u.email.toLowerCase() === userId.toLowerCase()
    );
    if (memUser) {
      userPasswordHash = memUser.passwordHash;
    }
  }

  if (!userPasswordHash) {
    throw new Error("User account not found.");
  }

  // Verify current password
  const isValidCurrent = await verifyPassword(currentPassword, userPasswordHash);
  if (!isValidCurrent) {
    throw new Error("Current password is incorrect. Please verify and try again.");
  }

  if (newPassword.length < 8) {
    throw new Error("New password must be at least 8 characters long.");
  }

  // Hash new password
  const newHash = await hashPassword(newPassword);

  if (dbUserId && db) {
    await db
      .update(schema.users)
      .set({
        passwordHash: newHash,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, dbUserId));
  }

  const memUser = DEMO_USERS.find(
    (u) => u.id === userId || u.staffId.toLowerCase() === userId.toLowerCase() || u.email.toLowerCase() === userId.toLowerCase()
  );
  if (memUser) {
    memUser.passwordHash = newHash;
  }

  return { success: true, message: "Account password updated successfully." };
}

export async function updateUserPin(
  userId: string,
  newPin: string
): Promise<{ success: boolean; message: string }> {
  await initializeStore();

  if (!/^\d{4}$/.test(newPin)) {
    throw new Error("PIN must be exactly 4 numeric digits.");
  }

  const newPinHash = await hashPin(newPin);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

  if (db) {
    try {
      let resolvedUserId = isUuid ? userId : null;
      if (!resolvedUserId) {
        const foundUser = await db.query.users.findFirst({
          where: (u, { eq, or }) => or(eq(u.staffId, userId), eq(u.email, userId.toLowerCase())),
        });
        if (foundUser) {
          resolvedUserId = foundUser.id;
        }
      }

      if (resolvedUserId) {
        const existingPin = await db.query.userPins.findFirst({
          where: (p, { eq }) => eq(p.userId, resolvedUserId!),
        });

        if (existingPin) {
          await db
            .update(schema.userPins)
            .set({
              pinHash: newPinHash,
              failedAttempts: 0,
              lockedUntil: null,
              updatedAt: new Date(),
            })
            .where(eq(schema.userPins.id, existingPin.id));
        } else {
          await db.insert(schema.userPins).values({
            userId: resolvedUserId as any,
            pinHash: newPinHash,
            failedAttempts: 0,
            updatedAt: new Date(),
          });
        }
      }
    } catch (err) {
      console.warn("DB userPins update failed:", err);
      throw new Error("Failed to update PIN in database.");
    }
  } else {
    const memUser = DEMO_USERS.find(
      (u) => u.id === userId || u.staffId.toLowerCase() === userId.toLowerCase() || u.email.toLowerCase() === userId.toLowerCase()
    );
    if (memUser) {
      memUser.pinHash = newPinHash;
    }
  }

  return { success: true, message: "Floor terminal PIN updated successfully." };
}

export async function verifyUserPin(
  userId: string,
  pin: string
): Promise<{ success: boolean; error?: string; remainingAttempts?: number }> {
  await initializeStore();

  if (!/^\d{4}$/.test(pin)) {
    return { success: false, error: "PIN must be exactly 4 numeric digits." };
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

  if (db) {
    try {
      let resolvedUserId = isUuid ? userId : null;
      if (!resolvedUserId) {
        const foundUser = await db.query.users.findFirst({
          where: (u, { eq, or }) => or(eq(u.staffId, userId), eq(u.email, userId.toLowerCase())),
        });
        if (foundUser) {
          resolvedUserId = foundUser.id;
        }
      }

      if (resolvedUserId) {
        const pinRecord = await db.query.userPins.findFirst({
          where: (p, { eq }) => eq(p.userId, resolvedUserId!),
        });

        if (pinRecord) {
          // Check lockout
          if (pinRecord.lockedUntil && new Date(pinRecord.lockedUntil) > new Date()) {
            const minsLeft = Math.ceil((new Date(pinRecord.lockedUntil).getTime() - Date.now()) / 60000);
            return {
              success: false,
              error: `Terminal temporarily locked due to repeated failed attempts. Try again in ${minsLeft} min${minsLeft > 1 ? "s" : ""}, or switch to password login.`,
            };
          }

          const isValid = await verifyPin(pin, pinRecord.pinHash);
          if (isValid) {
            // Reset attempts on successful PIN entry
            if (pinRecord.failedAttempts > 0 || pinRecord.lockedUntil) {
              await db
                .update(schema.userPins)
                .set({
                  failedAttempts: 0,
                  lockedUntil: null,
                  updatedAt: new Date(),
                })
                .where(eq(schema.userPins.id, pinRecord.id));
            }
            return { success: true };
          } else {
            const nextAttempts = (pinRecord.failedAttempts || 0) + 1;
            const isLockout = nextAttempts >= 5;
            const lockoutUntil = isLockout ? new Date(Date.now() + 5 * 60 * 1000) : null;

            await db
              .update(schema.userPins)
              .set({
                failedAttempts: nextAttempts,
                lockedUntil: lockoutUntil,
                updatedAt: new Date(),
              })
              .where(eq(schema.userPins.id, pinRecord.id));

            if (isLockout) {
              return {
                success: false,
                error: "Too many incorrect attempts (5/5). Terminal locked for 5 minutes. You can switch to password login.",
              };
            }

            const remaining = 5 - nextAttempts;
            return {
              success: false,
              error: `Incorrect PIN code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before temporary lock.`,
              remainingAttempts: remaining,
            };
          }
        }
      }
      return { success: false, error: "Floor PIN is not configured for this account. Please log in with your password." };
    } catch (err) {
      console.warn("DB verifyUserPin failed:", err);
      return { success: false, error: "Database error during PIN verification." };
    }
  }

  // Fallback memory demo users strictly for offline sandbox when db is null
  const memUser = DEMO_USERS.find(
    (u) => u.id === userId || u.staffId.toLowerCase() === userId.toLowerCase() || u.email.toLowerCase() === userId.toLowerCase()
  );
  if (memUser && memUser.pinHash) {
    const isValid = await verifyPin(pin, memUser.pinHash);
    if (isValid) {
      return { success: true };
    }
    return { success: false, error: "Incorrect PIN code. Please try again or switch to password login." };
  }

  return { success: false, error: "Floor PIN is not configured for this account. Please log in with your password." };
}

// ==========================================
// DB-DRIVEN DYNAMIC STAFF RESOLUTION HELPERS
// ==========================================

export async function getStaffByRole(role: string): Promise<SystemUser | null> {
  await initializeStore();
  if (db) {
    try {
      const results = await db.query.users.findMany({
        where: (u, { eq, and }) => and(eq(u.role, role as any), eq(u.isActive, true)),
        with: { department: true },
        limit: 1,
      });
      if (results && results.length > 0) {
        const u = results[0];
        return {
          id: u.id,
          staffId: u.staffId,
          fullName: u.fullName,
          email: u.email,
          departmentCode: (u.department?.code as string) || "INVENTORY_STORE",
          departmentName: u.department?.name || "Inventory Store",
          role: u.role,
          phone: u.phone || undefined,
          isActive: u.isActive,
          passwordHash: "",
          pinHash: "",
        };
      }
      return null;
    } catch (err) {
      console.warn(`NeonDB getStaffByRole(${role}) failed:`, err);
      return null;
    }
  }
  return DEMO_USERS.find((u) => u.role === role && u.isActive) || null;
}

export async function getStaffUsersByRole(role: string): Promise<SystemUser[]> {
  await initializeStore();
  if (db) {
    try {
      const results = await db.query.users.findMany({
        where: (u, { eq, and }) => and(eq(u.role, role as any), eq(u.isActive, true)),
        with: { department: true },
      });
      return (results || []).map((u) => ({
        id: u.id,
        staffId: u.staffId,
        fullName: u.fullName,
        email: u.email,
        departmentCode: (u.department?.code as string) || "INVENTORY_STORE",
        departmentName: u.department?.name || "Inventory Store",
        role: u.role,
        phone: u.phone || undefined,
        isActive: u.isActive,
        passwordHash: "",
        pinHash: "",
      }));
    } catch (err) {
      console.warn(`NeonDB getStaffUsersByRole(${role}) failed:`, err);
      return [];
    }
  }
  return DEMO_USERS.filter((u) => u.role === role && u.isActive);
}

export async function getDefaultSupervisorName(
  shiftType?: "MORNING_SHIFT" | "NIGHT_SHIFT"
): Promise<string> {
  try {
    const { resolveCurrentShiftSupervisors } = await import("../production/supervisorRotation");
    const resolution = await resolveCurrentShiftSupervisors();
    if (shiftType === "MORNING_SHIFT") {
      return resolution.morningSupervisor.name;
    }
    if (shiftType === "NIGHT_SHIFT") {
      return resolution.nightSupervisor.name;
    }
    return resolution.activeOnDutySupervisor.name;
  } catch (err) {
    const supervisor = await getStaffByRole("PRODUCTION_SUPERVISOR");
    return supervisor?.fullName?.replace(/\s*\([^)]*\)/g, "").trim() || "Production Supervisor";
  }
}

export async function getDefaultStoreManagerName(): Promise<string> {
  const storeMgr = await getStaffByRole("STORE_MANAGER");
  return storeMgr?.fullName?.replace(/\s*\([^)]*\)/g, "").trim() || "Store Manager";
}

export async function getActiveStaffRecipients(): Promise<
  Array<{ id: string; fullName: string; staffId: string; role: string; label: string }>
> {
  const all = await getAllUsers(false);
  const productionAndStore = all.filter(
    (u) =>
      u.role === "PRODUCTION_SUPERVISOR" ||
      u.role === "STORE_MANAGER" ||
      u.role === "STAFF" ||
      u.departmentCode === "PRODUCTION" ||
      u.departmentCode === "INVENTORY_STORE"
  );
  return productionAndStore.map((u) => {
    const cleanName = u.fullName.replace(/\s*\([^)]*\)/g, "").trim();
    const roleLabel =
      u.role === "PRODUCTION_SUPERVISOR"
        ? "Production Supervisor"
        : u.role === "STORE_MANAGER"
        ? "Store Manager"
        : "Floor Staff";
    return {
      id: u.id,
      fullName: cleanName,
      staffId: u.staffId,
      role: u.role,
      label: `${cleanName} (${roleLabel})`,
    };
  });
}

