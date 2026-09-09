import { db, schema } from "../db";
import { eq, or } from "drizzle-orm";
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
    fullName: "Chief Executive Officer",
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
    fullName: "Alhaji Musa (Store Manager)",
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
    id: "usr_store_off_004",
    staffId: "MOH-STR-02",
    fullName: "Blessing Okon (Store Officer)",
    email: "store.officer@mohfood.com",
    passwordHash: "sha256:stroff:mock",
    pinHash: "",
    departmentCode: "INVENTORY_STORE",
    departmentName: "Inventory Store Department",
    role: "STORE_OFFICER",
    phone: "+2348034567890",
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
];

// Initialise PIN and Password hashes
let initialized = false;
async function initializeStore() {
  if (initialized) return;
  const defaultPw = "ChangeThisSecurePassword123!";
  for (const u of DEMO_USERS) {
    u.passwordHash = await hashPassword(defaultPw);
  }
  DEMO_USERS[0].pinHash = await hashPin("1234");
  DEMO_USERS[1].pinHash = await hashPin("5678");
  DEMO_USERS[2].pinHash = await hashPin("1111");
  DEMO_USERS[3].pinHash = await hashPin("2222");
  DEMO_USERS[4].pinHash = await hashPin("3333");
  DEMO_USERS[5].pinHash = await hashPin("4444");
  initialized = true;
}

export async function findUserByIdentifier(identifier: string): Promise<SystemUser | null> {
  await initializeStore();
  const trimmed = identifier.trim().toLowerCase();

  // If live NeonDB is connected, query database
  if (db) {
    try {
      const result = await db.query.users.findFirst({
        where: (u, { or, eq }) => or(eq(u.email, trimmed), eq(u.staffId, identifier.trim())),
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
          role: result.role,
          pinHash: result.pin?.pinHash || "",
          phone: result.phone || undefined,
          isActive: result.isActive,
        };
      }
    } catch (err) {
      console.warn("NeonDB query failed, falling back to local store:", err);
    }
  }

  // Fallback to local store
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
            role: u.role,
            pinHash: u.pin.pinHash,
            phone: u.phone || undefined,
            isActive: u.isActive,
          };
        }
      }
    } catch (err) {
      console.warn("NeonDB findUserByPin failed, falling back to local store:", err);
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
      if (results && results.length > 0) {
        return results.map((u) => ({
          id: u.id,
          staffId: u.staffId,
          fullName: u.fullName,
          email: u.email,
          departmentCode: (u.department?.code as string) || "INVENTORY_STORE",
          departmentName: u.department?.name || "Inventory Store",
          role: u.role,
          phone: u.phone || undefined,
          isActive: u.isActive,
        }));
      }
    } catch (err) {
      console.warn("NeonDB getAllUsers failed, falling back to local store:", err);
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
  const allowedRoles = [
    "SUPER_ADMIN",
    "EXECUTIVE",
    "STORE_MANAGER",
    "STORE_OFFICER",
    "PRODUCTION_SUPERVISOR",
    "LOGISTICS_OFFICER",
    "ACCOUNTANT",
    "STAFF",
  ];
  const role = allowedRoles.includes(data.role) ? data.role : "STAFF";

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

      DEMO_USERS.unshift({
        ...safeUser,
        passwordHash,
        pinHash,
      });

      return safeUser;
    } catch (err: any) {
      if (err.message && (err.message.includes("already exists") || err.message.includes("already assigned"))) {
        throw err;
      }
      console.error("DB error in createStaffAccount:", err);
      throw new Error(err.message || "Failed to create staff account in database.");
    }
  }

  // Fallback in-memory
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
    } catch (err) {
      console.error("DB error in updateStaffStatus:", err);
    }
  }
  const memUser = DEMO_USERS.find((u) => u.id === userId);
  if (memUser) {
    memUser.isActive = isActive;
  }
  return true;
}

export async function deleteStaffAccount(userId: string): Promise<boolean> {
  if (db) {
    try {
      await db.update(schema.users).set({ isActive: false, updatedAt: new Date() }).where(eq(schema.users.id, userId));
    } catch (err) {
      console.error("DB error in deleteStaffAccount:", err);
    }
  }
  const idx = DEMO_USERS.findIndex((u) => u.id === userId);
  if (idx !== -1) {
    DEMO_USERS[idx].isActive = false;
  }
  return true;
}
