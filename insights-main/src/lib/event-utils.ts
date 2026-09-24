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

// Extract or infer product details from event or user event history
export function resolveProductDetails(r: any, allEvents: any[] = []): any | null {
  if (!r) return null;
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
      // Within 2 hours before or 1 minute after
      return t <= currentEventTime + 60000 && t >= currentEventTime - 2 * 60 * 60 * 1000;
    })
    .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Base catalog
  const productCatalog: Record<string, { productId: string; productName: string; price: number; category: string }> = {
    prod_1: { productId: "prod_1", productName: "MacBook Pro 16\"", price: 3299, category: "Laptops" },
    prod_2: { productId: "prod_2", productName: "iPhone 15 Pro Max", price: 1199, category: "Smartphones" },
    prod_3: { productId: "prod_3", productName: "Apple Watch Series 9", price: 349, category: "Smart Watches" },
    prod_4: { productId: "prod_4", productName: "Sony WH-1000XM5", price: 399, category: "Audio" },
    prod_5: { productId: "prod_5", productName: "Dell XPS 15", price: 1899, category: "Laptops" },
    prod_6: { productId: "prod_6", productName: "Lenovo ThinkPad X1 Carbon", price: 1549, category: "Business Laptops" },
  };

  // Populate/update catalog from session events
  sessionEvents.forEach((e: any) => {
    const ep = parseProps(e.properties);
    let pid = ep.productId;
    if (!pid && ep.url && ep.url.includes("/product/")) {
      pid = ep.url.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }
    if (!pid && ep.href && ep.href.includes("/product/")) {
      pid = ep.href.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }

    if (pid || ep.productName) {
      const idKey = pid || ep.productName;
      const existing = productCatalog[idKey] || {};
      const itemData = {
        productId: pid || existing.productId || idKey,
        productName: ep.productName || existing.productName || (idKey.startsWith("prod_") ? `Product ${idKey}` : idKey),
        price: Number(ep.price) || existing.price || 199,
        category: ep.category || existing.category || "General",
      };
      productCatalog[idKey] = itemData;
      if (pid) productCatalog[pid] = itemData;
      if (ep.productName) productCatalog[ep.productName] = itemData;
    }
  });

  // Track session cart & active product
  let currentActiveProduct: any = null;
  const sessionCart: Record<string, number> = {}; // productId -> quantity
  const cartAddCountUpToEvent: Record<string, number> = {}; // count of cart adds up to r

  for (const e of sessionEvents) {
    const ep = parseProps(e.properties);
    const isEPurchased = isItemPurchasedEvent(e, ep);
    const isECart = isAddToCartEvent(e, ep);
    const eTime = new Date(e.timestamp).getTime();

    // If a previous purchase/order event occurred before this event, reset sessionCart and cart counters
    if (isEPurchased && e.id !== r.id && eTime < currentEventTime) {
      for (const key of Object.keys(sessionCart)) {
        delete sessionCart[key];
      }
      for (const key of Object.keys(cartAddCountUpToEvent)) {
        delete cartAddCountUpToEvent[key];
      }
    }

    let pid = ep.productId;
    if (!pid && ep.url && ep.url.includes("/product/")) {
      pid = ep.url.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }
    if (!pid && ep.href && ep.href.includes("/product/")) {
      pid = ep.href.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }
    if (!pid && ep.text) {
      for (const knownId of Object.keys(productCatalog)) {
        if (ep.text.includes(productCatalog[knownId].productName)) {
          pid = knownId;
          break;
        }
      }
    }

    if (pid && productCatalog[pid]) {
      currentActiveProduct = productCatalog[pid];
    } else if (ep.productName) {
      currentActiveProduct = {
        productId: ep.productId || "prod_custom",
        productName: ep.productName,
        price: Number(ep.price) || 199,
        category: ep.category || "General",
      };
    }

    if (isECart) {
      const targetProd = (ep.productId && productCatalog[ep.productId]) || currentActiveProduct || productCatalog["prod_3"];
      const targetKey = targetProd?.productId || targetProd?.productName || "prod_3";
      const addQty = Number(ep.quantity) > 0 ? Number(ep.quantity) : 1;
      sessionCart[targetKey] = addQty;

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

  // Case 1: Item Purchased / Place Order Event
  if (isPurchased) {
    let items: Array<{
      productId: string;
      productName: string;
      category: string;
      price: number;
      quantity: number;
      subtotal: number;
    }> = [];

    // If session cart has items, build full order breakdown
    const cartKeys = Object.keys(sessionCart);
    if (cartKeys.length > 0) {
      items = cartKeys.map((key) => {
        const prod = productCatalog[key] || {
          productId: key,
          productName: key.startsWith("prod_") ? `Product ${key}` : key,
          price: 199,
          category: "General",
        };
        const qty = sessionCart[key] || 1;
        const price = Number(prod.price) || 199;
        return {
          productId: prod.productId || key,
          productName: prod.productName,
          category: prod.category || "General",
          price: price,
          quantity: qty,
          subtotal: price * qty,
        };
      });
    } else if (p.items && Array.isArray(p.items)) {
      items = p.items.map((item: any, idx: number) => ({
        productId: item.productId || `prod_${idx + 1}`,
        productName: item.productName || item.title || "Item",
        category: item.category || "General",
        price: Number(item.price) || 199,
        quantity: Number(item.quantity) || 1,
        subtotal: (Number(item.price) || 199) * (Number(item.quantity) || 1),
      }));
    } else if (p.productName || p.productId) {
      const qty = Number(p.quantity) || 1;
      const price = Number(p.price) || 349;
      items = [
        {
          productId: p.productId || "prod_3",
          productName: p.productName || "Apple Watch Series 9",
          category: p.category || "Smart Watches",
          price: price,
          quantity: qty,
          subtotal: price * qty,
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
        },
      ];
    } else {
      // Default fallback
      items = [
        {
          productId: "prod_3",
          productName: "Apple Watch Series 9 (Midnight Aluminium)",
          category: "Wearables & Watches",
          price: 349,
          quantity: 1,
          subtotal: 349,
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
      discount: p.discount || "Special Promo Applied",
      shipping: p.shipping || `Delivering to ${locationStr}`,
      status: "Order Confirmed",
    };
  }

  // Case 2: Add to Cart Event
  if (isCart) {
    let targetPid = p.productId;
    if (!targetPid && p.url && p.url.includes("/product/")) {
      targetPid = p.url.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }
    if (!targetPid && p.href && p.href.includes("/product/")) {
      targetPid = p.href.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }

    const prod =
      (targetPid && productCatalog[targetPid]) ||
      (p.productName && productCatalog[p.productName]) ||
      currentActiveProduct ||
      productCatalog["prod_3"];

    const targetKey = prod.productId || prod.productName || "prod_3";
    const qty = Number(p.quantity) > 0 ? Number(p.quantity) : 1;
    const price = Number(p.price) || prod.price || 199;
    const subtotal = Number(p.subtotal) > 0 ? Number(p.subtotal) : (price * qty);

    return {
      type: "cart",
      productName: p.productName || prod.productName,
      productId: prod.productId || targetKey,
      price: price,
      quantity: qty,
      category: p.category || prod.category || "General",
      subtotal: subtotal,
      discount: p.discount || "Save 6%",
      shipping: p.shipping || "Free standard shipping",
      status: "In Cart",
    };
  }

  // Case 3: Product Viewed Event
  if (isView) {
    let targetPid = p.productId;
    if (!targetPid && p.url && p.url.includes("/product/")) {
      targetPid = p.url.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }
    if (!targetPid && p.href && p.href.includes("/product/")) {
      targetPid = p.href.split("/product/")[1]?.split("?")[0]?.split("/")[0];
    }

    const prod =
      (targetPid && productCatalog[targetPid]) ||
      (p.productName && productCatalog[p.productName]) ||
      currentActiveProduct ||
      productCatalog["prod_1"];

    const price = Number(p.price) || prod.price || 3299;

    return {
      type: "view",
      productName: p.productName || prod.productName,
      productId: prod.productId || targetPid || "prod_1",
      price: price,
      quantity: 1,
      category: p.category || prod.category || "General",
      subtotal: price,
      discount: p.discount || "In Stock",
      shipping: p.shipping || "Free shipping available",
      status: "Product Viewed",
    };
  }

  // Case 4: General Product Event
  if (p.productName || p.productId) {
    const qty = Number(p.quantity) || 1;
    const price = Number(p.price) || 199;
    return {
      type: "product",
      productName: p.productName || "Product",
      productId: p.productId || "prod_custom",
      price: price,
      quantity: qty,
      category: p.category || "General",
      subtotal: price * qty,
      discount: p.discount || "Standard Pricing",
      shipping: p.shipping || "Standard shipping",
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
