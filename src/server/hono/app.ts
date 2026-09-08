import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { authRouter } from "./routes/auth";
import { inventoryRouter } from "./routes/inventory";
import { managementRouter } from "./routes/management";
import { productionRouter } from "./routes/production";
import { logisticsRouter } from "./routes/logistics";
import { adminRouter } from "./routes/admin";
import { uploadRouter } from "./routes/upload";
import { productStorageRouter } from "./routes/productStorage";

export const app = new Hono().basePath("/api");

// Global middlewares
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    enterprise: "Moh Industries Ltd / Moh Foods NG",
    nafdacReg: "A8-106771",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Mount modular sub-routers
app.route("/auth", authRouter);
app.route("/inventory", inventoryRouter);
app.route("/management", managementRouter);
app.route("/production", productionRouter);
app.route("/logistics", logisticsRouter);
app.route("/admin", adminRouter);
app.route("/upload", uploadRouter);
app.route("/product-storage", productStorageRouter);

export type AppType = typeof app;

