import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Product } from "@/data/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { PriceTier, cartLineKey, resolveLinePrice } from "@/lib/wholesalePricing";

export interface CartItem {
  product: Product;
  quantity: number;
  priceTier: PriceTier;
}

interface CartContextType {
  items: CartItem[];
  selectedKeys: Set<string>;
  addItem: (product: Product, qty?: number, priceTier?: PriceTier) => void;
  removeItem: (productId: string, priceTier?: PriceTier) => void;
  updateQuantity: (productId: string, qty: number, priceTier?: PriceTier) => void;
  clearCart: () => void;
  toggleSelected: (key: string) => void;
  selectAll: () => void;
  selectShop: (sellerId: string, selected: boolean) => void;
  getSelectedItems: () => CartItem[];
  removeSelectedItems: (keys?: string[]) => void;
  isSelected: (key: string) => boolean;
  total: number;
  selectedTotal: number;
  itemCount: number;
  selectedCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

const GUEST_KEY = "fb_marketplace_cart_guest";

function storageKey(userId: string | undefined): string {
  return userId ? `fb_marketplace_cart_${userId}` : GUEST_KEY;
}

function normalizeStoredItem(raw: unknown): CartItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as CartItem;
  if (!item.product?.id || !Number.isFinite(item.quantity)) return null;
  return {
    product: item.product,
    quantity: item.quantity,
    priceTier: item.priceTier === "wholesale" ? "wholesale" : "retail",
  };
}

function loadCartState(key: string): { items: CartItem[]; selectedKeys: string[] } {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { items: [], selectedKeys: [] };
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const items = parsed.map(normalizeStoredItem).filter(Boolean) as CartItem[];
      return {
        items,
        selectedKeys: items.map((i) => cartLineKey(i.product.id, i.priceTier)),
      };
    }
    if (parsed && typeof parsed === "object") {
      const items = Array.isArray(parsed.items)
        ? parsed.items.map(normalizeStoredItem).filter(Boolean) as CartItem[]
        : [];
      const selectedKeys = Array.isArray(parsed.selectedKeys)
        ? parsed.selectedKeys.map(String)
        : items.map((i) => cartLineKey(i.product.id, i.priceTier));
      return { items, selectedKeys };
    }
    return { items: [], selectedKeys: [] };
  } catch {
    return { items: [], selectedKeys: [] };
  }
}

function saveCartState(key: string, items: CartItem[], selectedKeys: Set<string>) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ items, selectedKeys: [...selectedKeys] }),
    );
  } catch {
    /* ignore quota errors */
  }
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const prevUserId = useRef<string | undefined>(undefined);
  const initial = loadCartState(storageKey(undefined));
  const [items, setItems] = useState<CartItem[]>(initial.items);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set(initial.selectedKeys));

  useEffect(() => {
    const key = storageKey(userId);
    if (prevUserId.current !== userId) {
      const loaded = loadCartState(key);
      setItems(loaded.items);
      setSelectedKeys(new Set(loaded.selectedKeys.length ? loaded.selectedKeys : loaded.items.map((i) => cartLineKey(i.product.id, i.priceTier))));
      prevUserId.current = userId;
    }
  }, [userId]);

  useEffect(() => {
    saveCartState(storageKey(userId), items, selectedKeys);
  }, [items, selectedKeys, userId]);

  const addItem = useCallback((product: Product, qty = 1, priceTier: PriceTier = "retail") => {
    const key = cartLineKey(product.id, priceTier);
    setItems((prev) => {
      const existing = prev.find((i) => cartLineKey(i.product.id, i.priceTier) === key);
      if (existing) {
        return prev.map((i) =>
          cartLineKey(i.product.id, i.priceTier) === key
            ? { ...i, quantity: i.quantity + qty }
            : i
        );
      }
      return [...prev, { product, quantity: qty, priceTier }];
    });
    setSelectedKeys((prev) => new Set(prev).add(key));
  }, []);

  const removeItem = useCallback((productId: string, priceTier: PriceTier = "retail") => {
    const key = cartLineKey(productId, priceTier);
    setItems((prev) => prev.filter((i) => cartLineKey(i.product.id, i.priceTier) !== key));
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const updateQuantity = useCallback((productId: string, qty: number, priceTier: PriceTier = "retail") => {
    const key = cartLineKey(productId, priceTier);
    if (qty <= 0) {
      setItems((prev) => prev.filter((i) => cartLineKey(i.product.id, i.priceTier) !== key));
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      setItems((prev) =>
        prev.map((i) => (cartLineKey(i.product.id, i.priceTier) === key ? { ...i, quantity: qty } : i))
      );
    }
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setSelectedKeys(new Set());
    try {
      localStorage.removeItem(storageKey(userId));
    } catch {
      /* ignore */
    }
  }, [userId]);

  const toggleSelected = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedKeys(new Set(items.map((i) => cartLineKey(i.product.id, i.priceTier))));
  }, [items]);

  const selectShop = useCallback((sellerId: string, selected: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const item of items) {
        const key = cartLineKey(item.product.id, item.priceTier);
        if (item.product.sellerId === sellerId) {
          if (selected) next.add(key);
          else next.delete(key);
        }
      }
      return next;
    });
  }, [items]);

  const getSelectedItems = useCallback(() => {
    return items.filter((i) => selectedKeys.has(cartLineKey(i.product.id, i.priceTier)));
  }, [items, selectedKeys]);

  const removeSelectedItems = useCallback((keys?: string[]) => {
    const toRemove = new Set(keys ?? [...selectedKeys]);
    setItems((prev) => prev.filter((i) => !toRemove.has(cartLineKey(i.product.id, i.priceTier))));
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const key of toRemove) next.delete(key);
      return next;
    });
  }, [selectedKeys]);

  const isSelected = useCallback((key: string) => selectedKeys.has(key), [selectedKeys]);

  const total = useMemo(
    () => items.reduce((sum, i) => {
      const resolved = resolveLinePrice(i.product, i.quantity, i.priceTier);
      return sum + resolved.unitPrice * i.quantity;
    }, 0),
    [items],
  );

  const selectedItems = useMemo(
    () => items.filter((i) => selectedKeys.has(cartLineKey(i.product.id, i.priceTier))),
    [items, selectedKeys],
  );

  const selectedTotal = useMemo(
    () => selectedItems.reduce((sum, i) => {
      const resolved = resolveLinePrice(i.product, i.quantity, i.priceTier);
      return sum + resolved.unitPrice * i.quantity;
    }, 0),
    [selectedItems],
  );

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const selectedCount = selectedItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        selectedKeys,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        toggleSelected,
        selectAll,
        selectShop,
        getSelectedItems,
        removeSelectedItems,
        isSelected,
        total,
        selectedTotal,
        itemCount,
        selectedCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export { cartLineKey };
