export function parseProps(properties: any): Record<string, any> {
  if (!properties) return {};
  if (typeof properties === "object") return properties;
  if (typeof properties === "string") {
    try {
      return JSON.parse(properties);
    } catch {
      return {};
    }
  }
  return {};
}

export function isItemPurchasedEvent(r: any, p?: Record<string, any>): boolean {
  if (!r) return false;
  const props = p || parseProps(r.properties);
  const eventName = String(r.event || "").toLowerCase().trim();
  if (
    eventName === "item purchased" ||
    eventName === "item_purchased" ||
    eventName === "purchase" ||
    eventName === "order placed" ||
    eventName === "order_placed" ||
    eventName === "order_completed"
  ) {
    return true;
  }
  const text = String(props.text || "").toLowerCase().trim();
  if (
    text.includes("place order") ||
    text.includes("buy now") ||
    text.includes("order now") ||
    text.includes("complete order") ||
    text.includes("item purchased")
  ) {
    return true;
  }
  return false;
}

export function isAddToCartEvent(r: any, p?: Record<string, any>): boolean {
  if (!r) return false;
  const props = p || parseProps(r.properties);
  const eventName = String(r.event || "").toLowerCase().trim();
  if (
    eventName === "add to cart" ||
    eventName === "add_to_cart" ||
    eventName === "cart_add" ||
    eventName === "add_cart"
  ) {
    return true;
  }
  const text = String(props.text || "").trim().toLowerCase();
  if (
    text.includes("add to cart") ||
    text.includes("add to bag") ||
    text.includes("add to basket") ||
    text === "+" ||
    props.action === "add_to_cart" ||
    props.action === "addToCart"
  ) {
    return true;
  }
  return false;
}

export function isProductViewedEvent(r: any, p?: Record<string, any>): boolean {
  if (!r) return false;
  const props = p || parseProps(r.properties);
  const eventName = String(r.event || "").toLowerCase().trim();
  if (
    eventName === "product viewed" ||
    eventName === "product_viewed" ||
    eventName === "view_item" ||
    eventName === "view product"
  ) {
    return true;
  }
  if (props.productName || props.productId) {
    if (!isAddToCartEvent(r, props) && !isItemPurchasedEvent(r, props)) {
      return true;
    }
  }
  return false;
}

export interface ResolvedProductItem {
  productId: string;
  productName: string;
  price: number;
  category: string;
  imageUrl?: string;
  url?: string;
  quantity?: number;
  subtotal?: number;
  [key: string]: any;
}

let globalCatalogCache: Record<string, ResolvedProductItem> = {};
let catalogFetchPromise: Promise<Record<string, ResolvedProductItem>> | null = null;

export function setGlobalCatalog(items: any[]) {
  if (!Array.isArray(items)) return;
  items.forEach((item) => {
    const d = item.data || item;
    const pid = String(d.productId || d.id || item.id || "").toLowerCase();
    const name = String(d.name || d.productName || d.title || "").toLowerCase();
    const resolved: ResolvedProductItem = {
      productId: String(d.productId || d.id || item.id || ""),
      productName: String(d.name || d.productName || d.title || "Product"),
      price: Number(d.price) || 0,
      category: String(d.category || "General"),
      imageUrl: String(d.imageUrl || d.image || d.productImage || ""),
      url: String(d.url || (d.productId ? `/product/${d.productId}` : "")),
    };
    if (pid) globalCatalogCache[pid] = resolved;
    if (name) globalCatalogCache[name] = resolved;
    if (d.productId) globalCatalogCache[String(d.productId)] = resolved;
    if (d.name) globalCatalogCache[String(d.name)] = resolved;
  });
}

export async function loadDynamicCatalog(): Promise<Record<string, ResolvedProductItem>> {
  if (Object.keys(globalCatalogCache).length > 0) return globalCatalogCache;
  if (catalogFetchPromise) return catalogFetchPromise;
  catalogFetchPromise = (async () => {
    try {
      if (typeof window !== "undefined") {
        const res = await fetch("/api/catalog/products");
        if (res.ok) {
          const items = await res.json();
          setGlobalCatalog(items);
        }
      }
    } catch (err) {
      console.error("Failed to load dynamic catalog", err);
    }
    return globalCatalogCache;
  })();
  return catalogFetchPromise;
}

if (typeof window !== "undefined") {
  loadDynamicCatalog().catch(() => {});
}

// Extract or infer product details dynamically from catalog and event history (SFMC Personalization style)
export function resolveProductDetails(
  r: any,
  allEvents: any[] = [],
  dynamicCatalog?: any[]
): any | null {
  if (!r) return null;
  if (Array.isArray(dynamicCatalog) && dynamicCatalog.length > 0) {
    setGlobalCatalog(dynamicCatalog);
  }

  const p = parseProps(r.properties);
  const isPurchased = isItemPurchasedEvent(r, p);
  const isCart = isAddToCartEvent(r, p);
  const isView = isProductViewedEvent(r, p);

  if (!isPurchased && !isCart && !isView && !p.productName && !p.productId && !p.items) {
    return null;
  }

  const currentEventTime = new Date(r.timestamp).getTime();
  const userKey = r.userId || r.anonId;

  // Filter and sort events for this user/session in chronological order (oldest to newest)
  const sessionEvents = (Array.isArray(allEvents) ? allEvents : [])
    .filter((e: any) => {
      const sameUser =
        (e.userId && r.userId && e.userId === r.userId) ||
        (e.anonId && r.anonId && e.anonId === r.anonId) ||
        (userKey && (e.userId === userKey || e.anonId === userKey));
      if (!sameUser) return false;
      const t = new Date(e.timestamp).getTime();
      return t <= currentEventTime + 60000 && t >= currentEventTime - 2 * 60 * 60 * 1000;
    })
    .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Dynamic catalog map starting from registered global catalog
  const productCatalog: Record<string, ResolvedProductItem> = { ...globalCatalogCache };

  // Helper to query dynamic catalog by ID or Name
  const lookupCatalog = (idOrName?: string | null): ResolvedProductItem | null => {
    if (!idOrName) return null;
    const key = String(idOrName).toLowerCase().trim();
    return productCatalog[key] || productCatalog[idOrName] || null;
  };

  // Populate/update catalog from session events dynamically
  sessionEvents.forEach((e: any) => {
    const ep = parseProps(e.properties);
    let pid = ep.productId || ep.id;
    if (!pid && ep.url && ep.url.includes("/product/")) {
      pid = ep.url.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }
    if (!pid && ep.href && ep.href.includes("/product/")) {
      pid = ep.href.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }

    const img = ep.imageUrl || ep.image || ep.productImage || ep.img;

    if (pid || ep.productName || ep.name) {
      const idKey = String(pid || ep.productName || ep.name).toLowerCase();
      const existing = lookupCatalog(idKey) || (pid ? lookupCatalog(pid) : null) || {};
      const itemData: ResolvedProductItem = {
        productId: pid || existing.productId || idKey,
        productName: ep.productName || ep.name || existing.productName || (String(idKey).startsWith("prod_") ? `Product ${idKey}` : String(idKey)),
        price: Number(ep.price) || existing.price || 0,
        category: ep.category || existing.category || "General",
        imageUrl: img || existing.imageUrl || "",
        url: ep.url || ep.href || existing.url || (pid ? `/product/${pid}` : ""),
      };
      productCatalog[idKey] = itemData;
      if (pid) productCatalog[String(pid).toLowerCase()] = itemData;
      if (ep.productName) productCatalog[String(ep.productName).toLowerCase()] = itemData;
    }
  });

  // Track session cart & active product
  let currentActiveProduct: ResolvedProductItem | null = null;
  const sessionCart: Record<string, ResolvedProductItem> = {};
  const cartAddCountUpToEvent: Record<string, number> = {};

  for (const e of sessionEvents) {
    const ep = parseProps(e.properties);
    const isEPurchased = isItemPurchasedEvent(e, ep);
    const isECart = isAddToCartEvent(e, ep);
    const eTime = new Date(e.timestamp).getTime();

    // Reset cart if purchase event occurred before this event
    if (isEPurchased && e.id !== r.id && eTime < currentEventTime) {
      for (const key of Object.keys(sessionCart)) delete sessionCart[key];
      for (const key of Object.keys(cartAddCountUpToEvent)) delete cartAddCountUpToEvent[key];
    }

    let pid = ep.productId || ep.id;
    if (!pid && ep.url && ep.url.includes("/product/")) {
      pid = ep.url.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }
    if (!pid && ep.href && ep.href.includes("/product/")) {
      pid = ep.href.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }

    const epImg = ep.imageUrl || ep.image || ep.productImage || ep.img;
    const catItem = lookupCatalog(pid) || lookupCatalog(ep.productName) || lookupCatalog(ep.name);

    if (catItem) {
      currentActiveProduct = { ...catItem, ...(epImg ? { imageUrl: epImg } : {}) };
    } else if (pid || ep.productName || ep.name) {
      currentActiveProduct = {
        productId: pid || "prod_custom",
        productName: ep.productName || ep.name || `Product ${pid}`,
        price: Number(ep.price) || 0,
        category: ep.category || "General",
        imageUrl: epImg || "",
        url: ep.url || (pid ? `/product/${pid}` : ""),
      };
    }

    if (isECart) {
      const targetProd = catItem || currentActiveProduct;
      const targetKey = String(targetProd?.productId || pid || ep.productName || "cart_item");
      const addQty = Number(ep.quantity) > 0 ? Number(ep.quantity) : 1;
      const unitPrice = Number(ep.price) > 0 ? Number(ep.price) : (targetProd?.price || 0);

      sessionCart[targetKey] = {
        productId: targetKey,
        productName: targetProd?.productName || ep.productName || targetKey,
        price: unitPrice,
        category: ep.category || targetProd?.category || "General",
        imageUrl: epImg || targetProd?.imageUrl || "",
        quantity: addQty,
        subtotal: unitPrice * addQty,
      };

      if (eTime <= currentEventTime) {
        cartAddCountUpToEvent[targetKey] = addQty;
      }
    }
  }

  // Location string for shipping
  const pCity = p.city || (typeof r?.properties === "string" && parseProps(r.properties).city) || "Pune";
  const pRegion = p.region || (typeof r?.properties === "string" && parseProps(r.properties).region) || "Maharashtra";
  const country = r?.country && r.country !== "Unknown" ? r.country : "India";
  const locationStr = `${pCity}, ${pRegion}, ${country}`;

  const currentImg = p.imageUrl || p.image || p.productImage || p.img;
  let targetPid = p.productId || p.id;
  if (!targetPid && p.url && p.url.includes("/product/")) {
    targetPid = p.url.split("/product/")[1]?.split("?")[0]?.split("/")[0];
  }
  if (!targetPid && r.url && r.url.includes("/product/")) {
    targetPid = r.url.split("/product/")[1]?.split("?")[0]?.split("/")[0];
  }
  const directCatMatch = lookupCatalog(targetPid) || lookupCatalog(p.productName) || lookupCatalog(p.name);

  // Case 1: Item Purchased / Place Order Event
  if (isPurchased) {
    let items: Array<{
      productId: string;
      productName: string;
      category: string;
      price: number;
      quantity: number;
      subtotal: number;
      imageUrl?: string;
    }> = [];

    const cartKeys = Object.keys(sessionCart);
    if (cartKeys.length > 0) {
      items = cartKeys.map((key) => {
        const prod = sessionCart[key];
        return {
          productId: prod.productId || key,
          productName: prod.productName,
          category: prod.category || "General",
          price: prod.price,
          quantity: prod.quantity || 1,
          subtotal: (prod.price || 0) * (prod.quantity || 1),
          imageUrl: prod.imageUrl || "",
        };
      });
    } else if (p.items && Array.isArray(p.items)) {
      items = p.items.map((item: any, idx: number) => {
        const itemPid = item.productId || item.id || `item_${idx + 1}`;
        const cat = lookupCatalog(itemPid) || lookupCatalog(item.productName || item.title);
        const itemPrice = Number(item.price) > 0 ? Number(item.price) : (cat?.price || 0);
        const itemQty = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
        return {
          productId: itemPid,
          productName: item.productName || item.title || cat?.productName || `Item ${idx + 1}`,
          category: item.category || cat?.category || "General",
          price: itemPrice,
          quantity: itemQty,
          subtotal: itemPrice * itemQty,
          imageUrl: item.imageUrl || item.image || cat?.imageUrl || "",
        };
      });
    } else if (p.productName || p.productId || targetPid || directCatMatch) {
      const pid = targetPid || p.productId || directCatMatch?.productId || "order_item";
      const name = p.productName || directCatMatch?.productName || `Product (${pid})`;
      const price = Number(p.price) > 0 ? Number(p.price) : (directCatMatch?.price || 0);
      const qty = Number(p.quantity) > 0 ? Number(p.quantity) : 1;
      const img = currentImg || directCatMatch?.imageUrl || "";
      items = [
        {
          productId: pid,
          productName: name,
          category: p.category || directCatMatch?.category || "General",
          price: price,
          quantity: qty,
          subtotal: price * qty,
          imageUrl: img,
        },
      ];
    } else if (currentActiveProduct) {
      items = [
        {
          productId: currentActiveProduct.productId,
          productName: currentActiveProduct.productName,
          category: currentActiveProduct.category,
          price: currentActiveProduct.price,
          quantity: 1,
          subtotal: currentActiveProduct.price,
          imageUrl: currentActiveProduct.imageUrl || "",
        },
      ];
    } else {
      const price = Number(p.price) > 0 ? Number(p.price) : 0;
      items = [
        {
          productId: "order_item",
          productName: "Order Item",
          category: p.category || "General",
          price: price,
          quantity: 1,
          subtotal: price,
          imageUrl: currentImg || "",
        },
      ];
    }

    const grandTotal = items.reduce((sum, it) => sum + it.subtotal, 0);
    const totalUnits = items.reduce((sum, it) => sum + it.quantity, 0);

    return {
      type: "purchase",
      items,
      grandTotal,
      totalUnits,
      itemCount: items.length,
      discount: p.discount || "Standard Pricing",
      shipping: p.shipping || `Delivering to ${locationStr}`,
      status: "Order Confirmed",
    };
  }

  // Case 2: Add to Cart Event
  if (isCart) {
    const prod = directCatMatch || currentActiveProduct;
    const pid = targetPid || prod?.productId || "cart_item";
    const name = p.productName || prod?.productName || (targetPid ? `Product (${targetPid})` : "Cart Item");
    const price = Number(p.price) > 0 ? Number(p.price) : (prod?.price || 0);
    const qty = Number(p.quantity) > 0 ? Number(p.quantity) : 1;
    const img = currentImg || prod?.imageUrl || "";

    return {
      type: "cart",
      productId: pid,
      productName: name,
      price: price,
      quantity: qty,
      category: p.category || prod?.category || "General",
      subtotal: price * qty,
      imageUrl: img,
      discount: p.discount || "In Cart",
      shipping: p.shipping || "Standard shipping",
      status: "In Cart",
    };
  }

  // Case 3: Product Viewed Event
  if (isView) {
    const prod = directCatMatch || currentActiveProduct;
    const pid = targetPid || prod?.productId || "viewed_item";
    const name = p.productName || prod?.productName || (targetPid ? `Product (${targetPid})` : "Product");
    const price = Number(p.price) > 0 ? Number(p.price) : (prod?.price || 0);
    const img = currentImg || prod?.imageUrl || "";

    return {
      type: "view",
      productId: pid,
      productName: name,
      price: price,
      quantity: 1,
      category: p.category || prod?.category || "General",
      subtotal: price,
      imageUrl: img,
      discount: p.discount || "In Catalog",
      shipping: p.shipping || "Available",
      status: "Product Viewed",
    };
  }

  // Case 4: General Product Event
  if (p.productName || p.productId || targetPid) {
    const prod = directCatMatch || currentActiveProduct;
    const pid = targetPid || prod?.productId || "prod_item";
    const name = p.productName || prod?.productName || (targetPid ? `Product (${targetPid})` : "Product");
    const price = Number(p.price) > 0 ? Number(p.price) : (prod?.price || 0);
    const qty = Number(p.quantity) > 0 ? Number(p.quantity) : 1;
    const img = currentImg || prod?.imageUrl || "";

    return {
      type: "product",
      productId: pid,
      productName: name,
      price: price,
      quantity: qty,
      category: p.category || prod?.category || "General",
      subtotal: price * qty,
      imageUrl: img,
      discount: p.discount || "Standard",
      shipping: p.shipping || "Standard",
      status: "Product Interaction",
    };
  }

  return null;
}

export function getDisplayEventName(r: any): string {
  if (!r) return "event";
  const p = parseProps(r.properties);
  if (isItemPurchasedEvent(r, p)) return "Item purchased";
  if (isAddToCartEvent(r, p)) return "Add to Cart";
  if (isProductViewedEvent(r, p)) return "Product Viewed";
  const eventName = String(r.event || "").trim();
  if (eventName === "page_view" || eventName === "pageview") return "Page View";
  if (eventName === "user_identified" || eventName === "identify") return "User Identified";
  if (eventName === "user_logged_out" || eventName === "logout") return "User Logged Out";
  if (eventName === "click") return "Click";
  return eventName || "event";
}

export function getDisplayEventTitle(r: any, allEvents: any[] = []): string {
  if (!r) return "Interaction";
  const p = parseProps(r.properties);
  const prodInfo = resolveProductDetails(r, allEvents);
  const prodName = p.productName || prodInfo?.productName || (p.productId ? `Product (${p.productId})` : null);

  if (isAddToCartEvent(r, p)) {
    return prodName ? `Added to Cart: ${prodName}` : "Added item to Cart";
  }
  if (isItemPurchasedEvent(r, p)) {
    return prodName ? `Purchased: ${prodName}` : "Completed Order / Purchase";
  }
  if (isProductViewedEvent(r, p)) {
    return prodName ? `Product Viewed: ${prodName}` : "Product Viewed";
  }

  const rawEvent = String(r.event || "").trim();
  if (rawEvent === "page_view" || rawEvent === "pageview") {
    const pageTitle = p.title || p.path || p.url || "/";
    return `Viewed ${pageTitle}`;
  }
  if (rawEvent === "user_identified" || rawEvent === "login") {
    const who = p.email || p.subscriberKey || r.userId || "User";
    return `Identified as ${who}`;
  }
  if (rawEvent === "user_logged_out" || rawEvent === "logout") {
    return "User Logged Out";
  }
  if (rawEvent === "click") {
    const text = (p.text || "").trim();
    if (text) {
      const truncated = text.length > 40 ? `${text.substring(0, 40)}...` : text;
      return `Clicked "${truncated}"`;
    }
    return "Clicked element";
  }

  if (prodName) {
    return `${rawEvent}: ${prodName}`;
  }
  return rawEvent || "Interaction";
}

export const getEventTitle = getDisplayEventTitle;

/**
 * Deduplicates rapid duplicate events and redundant auto-tracked click events
 */
export function deduplicateEvents(rawList: any[]): any[] {
  if (!Array.isArray(rawList) || rawList.length === 0) return [];

  const deduplicated: any[] = [];
  for (let i = 0; i < rawList.length; i++) {
    const curr = rawList[i];
    const currP = parseProps(curr.properties);
    const currTime = new Date(curr.timestamp).getTime();
    const currUser = curr.userId || curr.anonId;
    const currEventName = String(curr.event || "").toLowerCase().trim();

    // 1. Skip auto-tracked "click" on Add to Cart button if an explicit Add to Cart event exists nearby (< 3s)
    if (currEventName === "click" && String(currP.text || "").toLowerCase().includes("add to cart")) {
      const hasExplicitAdd = rawList.some((other, j) => {
        if (i === j) return false;
        const otherUser = other.userId || other.anonId;
        if (otherUser !== currUser) return false;
        const otherTime = new Date(other.timestamp).getTime();
        const otherName = String(other.event || "").toLowerCase().trim();
        return (otherName === "add to cart" || otherName === "add_to_cart") && Math.abs(currTime - otherTime) < 3000;
      });
      if (hasExplicitAdd) continue;
    }

    // 2. Deduplicate consecutive identical events within 2 seconds
    if (deduplicated.length > 0) {
      const prev = deduplicated[deduplicated.length - 1];
      const prevUser = prev.userId || prev.anonId;
      const prevTime = new Date(prev.timestamp).getTime();
      const prevP = parseProps(prev.properties);
      const sameProd = (currP.productId && currP.productId === prevP.productId) || 
                       (currP.productName && currP.productName === prevP.productName);

      const currDisplay = getDisplayEventName(curr);
      const prevDisplay = getDisplayEventName(prev);

      // Same event type for same user within 2 seconds
      const sameAction = (curr.event === prev.event) || (currDisplay === prevDisplay && currDisplay !== "Click");
      const withinTime = Math.abs(currTime - prevTime) < 2000;

      if (prevUser === currUser && sameAction && (sameProd || withinTime)) {
        continue;
      }
    }

    deduplicated.push(curr);
  }
  return deduplicated;
}
