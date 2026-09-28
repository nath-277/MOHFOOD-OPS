import useSWR, { mutate, SWRConfiguration } from "swr";
import { InventoryItem, ProductRecipe, StockTransaction } from "@/server/inventory/store";

export const fetcher = async <T = any>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const error = new Error(errorData.error || `HTTP error ${res.status}`);
    (error as any).status = res.status;
    (error as any).info = errorData;
    throw error;
  }
  return res.json();
};

export const defaultSWRConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: false, // Prevent jarring tab switches
  revalidateIfStale: true,
  dedupingInterval: 10000, // 10s deduplication window
  keepPreviousData: true, // Smooth transitions without UI blinking
};

// 1. Hook for Inventory Items
export function useInventoryItems(category = "ALL") {
  const url = `/api/inventory/items?category=${category}`;
  const { data, error, isLoading, isValidating, mutate: mutateItems } = useSWR<{
    success: boolean;
    items: InventoryItem[];
  }>(url, fetcher, defaultSWRConfig);

  return {
    items: data?.items || [],
    isLoading,
    isValidating,
    error,
    mutate: mutateItems,
  };
}

// 2. Hook for Product Recipes
export function useProductRecipes() {
  const url = "/api/inventory/recipes";
  const { data, error, isLoading, isValidating, mutate: mutateRecipes } = useSWR<{
    success: boolean;
    recipes: ProductRecipe[];
  }>(url, fetcher, defaultSWRConfig);

  return {
    recipes: data?.recipes || [],
    isLoading,
    isValidating,
    error,
    mutate: mutateRecipes,
  };
}

// 3. Hook for Stock Movements / Ledger
export function useStockMovements(queryString: string) {
  const url = `/api/inventory/transactions?${queryString}`;
  const { data, error, isLoading, isValidating, mutate: mutateMovements } = useSWR<{
    transactions: StockTransaction[];
    pagination?: any;
  }>(url, fetcher, defaultSWRConfig);

  return {
    transactions: data?.transactions || [],
    pagination: data?.pagination,
    isLoading,
    isValidating,
    error,
    mutate: mutateMovements,
  };
}

// Cache invalidation helpers for immediate UI synchronization after writes
export const invalidateInventory = () => {
  return mutate(
    (key) => typeof key === "string" && key.startsWith("/api/inventory/items"),
    undefined,
    { revalidate: true }
  );
};

export const invalidateRecipes = () => {
  return mutate("/api/inventory/recipes");
};

export const invalidateMovements = () => {
  return mutate(
    (key) => typeof key === "string" && key.startsWith("/api/inventory/transactions"),
    undefined,
    { revalidate: true }
  );
};

export const invalidateAllInventoryData = () => {
  return Promise.all([
    invalidateInventory(),
    invalidateRecipes(),
    invalidateMovements(),
  ]);
};

import type { RetailStockist, WhatsAppInvoice } from "@/server/management/store";

export interface ManagementOverviewData {
  success: boolean;
  rawStockValuation: number;
  totalConsignmentDebt: number;
  pendingInvoices: number;
  dailyOutput: number;
  targetOutput: number;
  totalStockists: number;
  activeAccountsPending: number;
}

// 4. Hook for Management Overview (Executive KPI Hub)
export function useManagementOverview() {
  const url = "/api/management/overview";
  const { data, error, isLoading, isValidating, mutate: mutateOverview } = useSWR<ManagementOverviewData>(
    url,
    fetcher,
    defaultSWRConfig
  );

  return {
    overview: data,
    isLoading,
    isValidating,
    error,
    mutate: mutateOverview,
  };
}

// 5. Hook for Retail Stockists
export function useManagementStockists(searchQuery = "") {
  const url = `/api/management/stockists?search=${encodeURIComponent(searchQuery)}`;
  const { data, error, isLoading, isValidating, mutate: mutateStockists } = useSWR<{
    success: boolean;
    stockists: RetailStockist[];
  }>(url, fetcher, defaultSWRConfig);

  return {
    stockists: data?.stockists || [],
    isLoading,
    isValidating,
    error,
    mutate: mutateStockists,
  };
}

// 6. Hook for WhatsApp Invoices
export function useWhatsAppInvoices(statusFilter = "ALL") {
  const url = `/api/management/whatsapp-invoices?status=${statusFilter}`;
  const { data, error, isLoading, isValidating, mutate: mutateInvoices } = useSWR<{
    success: boolean;
    invoices: WhatsAppInvoice[];
  }>(url, fetcher, defaultSWRConfig);

  return {
    invoices: data?.invoices || [],
    isLoading,
    isValidating,
    error,
    mutate: mutateInvoices,
  };
}

// 7. Hook for Par Levels
export function useParLevels() {
  const url = "/api/management/par-levels";
  const { data, error, isLoading, isValidating, mutate: mutatePar } = useSWR<{
    success: boolean;
    parRunways: any[];
  }>(url, fetcher, defaultSWRConfig);

  return {
    parRunways: data?.parRunways || [],
    isLoading,
    isValidating,
    error,
    mutate: mutatePar,
  };
}

export const invalidateManagementData = () => {
  return Promise.all([
    mutate("/api/management/overview"),
    mutate((key) => typeof key === "string" && key.startsWith("/api/management/stockists")),
    mutate((key) => typeof key === "string" && key.startsWith("/api/management/whatsapp-invoices")),
    mutate("/api/management/par-levels"),
    mutate("/api/inventory/recipes"),
  ]);
};
