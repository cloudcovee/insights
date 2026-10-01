<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

---

## Development Rules

> [!IMPORTANT]
> **Never break working functionality.** If any feature is already working correctly, do not change its logic, structure, or behaviour unless there is a clear bug or the user explicitly asks for a change. All updates must preserve existing functionality end-to-end.

### Core Principles

1. **Preserve working flows first** — Before touching any file, verify whether the existing code is functional. If it works, extend it rather than replacing it.

2. **Real-time catalog population** — When a user views a product or a category on the client site, the item is automatically added to the matching catalog via `upsertProductIntoCatalog()` called inside the event ingestion handler (`POST /api/track`). The function routes by detected entity type — product events go to the `products` catalog, category events go to the `categories` catalog — matched loosely by catalog name. Do not remove or bypass this call, and never route an item into a catalog that doesn't match its type.

3. **Image URLs must come from the client** — Product images are taken strictly from what the client SDK sends (`props.imageUrl`, `props.image`, `props.productImage`, `props.img`). Never fabricate, guess, or generate image URLs. If the client doesn't send one, leave `imageUrl` empty.

4. **Delete block list is scoped by catalog** — Deleted products are persisted in `local-deleted-products.json` as `"collectionId:productId"` scoped keys. This means a delete in one catalog **never blocks** that product in another catalog or account. The blocked id is taken from the item's `productId` / `categoryId` / `id`, falling back to the `/product/<slug>` or `/category/<slug>` in its `url`, so URL-only items are still blocked after delete. Both `upsertProductIntoCatalog()` and `syncProductsCatalogFromEvents()` check `isProductDeleted(collectionId, pId)` before creating items. Do not remove or skip this check, and always pass `collId` as the second argument to `markProductIdDeleted()`.

5. **Catalog auto-sync is a fallback** — `syncProductsCatalogFromEvents()` runs lazily when the catalog page loads. `upsertProductIntoCatalog()` handles the real-time path. Both must remain in sync with the delete block list. Sync only populates the catalog whose page is loaded, and only with events matching that catalog's entity type — loading the categories catalog never pulls product events into it.

6. **Optimistic UI deletes** — `handleDeleteItem()` removes the item from local state immediately and rolls back with a toast if the API call fails. Keep this pattern intact.

7. **Avg View Time calculation** — Prioritise explicit duration fields from events (`duration`, `view_time`, `timeOnPage`). Fall back to measuring gap to the user's next event, skipping sub-500ms micro-events, capped at 10 minutes. Do not regress to the old hardcoded 25s/30s fallback without the gap check.

### File Responsibilities

| File | Purpose |
|---|---|
| `src/lib/server-db.ts` | All persistence helpers — read/write JSON, entity-routed upsert, delete block list |
| `src/server.ts` | HTTP request router — event ingest, catalog CRUD, auth |
| `src/routes/_dash.catalogs.$catalogId.tsx` | Catalog UI — table, drawer, delete handler, analytics map |

### Do Not

- Do not `force push`, `rebase`, or `amend` commits already pushed to the connected branch.
- Do not remove the `} // end isProductAction` block from the event ingest loop — it guards the catalog upsert.
- Do not replace `upsertProductIntoCatalog` calls with `syncProductsCatalogFromEvents` — they serve different timing purposes.
- Do not add hardcoded image URLs, placeholder images, or fallback image generators.
- Do not call `markProductIdDeleted(data)` without the second `collectionId` argument — it will silently use a wrong key and block nothing or block everything.
- Do not change the block list format back to a flat array of bare product IDs — that format is global and pollutes all catalogs.
- Do not filter catalogs strictly by `projectId` in upsert/sync — events arrive with a different projectId than the catalogs; matching is by catalog name / entity type only.
- Do not route product events into the categories catalog or vice versa — `upsertProductIntoCatalog()` and `syncProductsCatalogFromEvents()` must keep each entity in its matching catalog.
