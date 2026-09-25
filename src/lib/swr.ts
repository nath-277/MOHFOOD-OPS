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
