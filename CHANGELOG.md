# Changelog

All notable changes to the Cloudcove Insights project will be documented in this file.

## [Unreleased]

### Added
- **API Key Management:** Added a dedicated API Keys page in the dashboard to generate and securely rotate Public and Secret keys.
- **Secure Key Storage:** Backend now stores API keys exclusively as `sha256` hashes in `local-apikeys.json` to prevent credential exposure.
- **External Data Ingestion API:** Added `POST /api/v1/collections/:id/import` for pushing data into collections from external systems (like Postman or Client Servers).
- **Upsert Capability:** External payloads now support an `externalId` property. If an item is pushed with an existing `externalId`, the backend updates the existing item instead of creating duplicates.
- **Dynamic Content Collections:** Implemented a full schema-driven collection system allowing users to define their own data structures (String, Number, Boolean).
- **Staging & Publishing Workflow:** All incoming data (manual or API) is forced into a 'Staging' queue and validated against the schema. Items must be explicitly 'Published'.
- **Live Sidebar Updates:** Sidebar now uses a global `collections_updated` event listener to instantly display newly created or deleted collections without a browser refresh.
- **Live Data Polling:** The Staging data table now automatically polls the backend every 5 seconds to instantly reflect data pushed via the external API.
- **Project Isolation:** All API routes strictly enforce `projectId` ownership checks to prevent cross-tenant data access.

### Fixed
- Fixed an issue where creating a collection required a manual browser refresh to appear in the sidebar.
- Fixed a state error where manually added items were not properly displaying in the staging table immediately.

### Security
- The external API relies strictly on `Authorization: Bearer <secret_key>`.
- Secret keys are shown to the user only once upon generation.
- The `projectId` is never trusted from client payloads, it is exclusively derived server-side from the authenticated session cookie or API key.
