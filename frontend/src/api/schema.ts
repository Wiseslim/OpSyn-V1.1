// ============================================================
// Convenience aliases over the generated OpenAPI types.
//
// schema.gen.ts is machine-written and deeply nested; this file is the
// hand-maintained surface that application code imports from.
//
// Prefer these over the hand-written equivalents in shared-types when
// describing anything that crosses the wire. shared-types has drifted
// from the API four times (OutageIncident, TaskWorkflowPayload,
// StaffStatus, job_title); these types cannot, because they are
// regenerated from the backend and `npm run types:check` fails the build
// when they fall out of date.
// ============================================================

import type { components, paths } from './schema.gen';

/**
 * A named schema from the backend's OpenAPI document.
 *
 *   type Staff = Schema<'StaffProfileOut'>;
 */
export type Schema<K extends keyof components['schemas']> = components['schemas'][K];

/** Every schema name the API publishes, for autocomplete. */
export type SchemaName = keyof components['schemas'];

/** The full path map, for typing a request or response by endpoint. */
export type ApiPaths = paths;

// ── Response helpers ──────────────────────────────────────────
// apiClient sets baseURL to the API root, so call sites write
// '/reports/summary' while the spec keys it '/api/v1/reports/summary'.
// These add the prefix so a helper can be typed from the path it already
// calls, with no second place to keep in sync.
//
// LIMITATION, measured 2026-09-17 against the live spec:
//
//     290 operations
//     107 with a typed request body
//       5 with a $ref'd response schema
//
// Almost no endpoint declares what it returns, because the handlers
// return bare dicts rather than a declared `response_model=`. So
// GetJson/PostJson resolve for only a handful of paths today and are
// here ready for when that changes -- use Schema<'Name'> meanwhile.
//
// Adding `response_model=` to the FastAPI handlers is the unlock: it
// would make the ~22 api/ helpers that unwrap `.data.data` typable from
// the spec, and would remove most of the `any` that flows from them into
// component callbacks. That is backend work, tracked separately.

type Pathify<P extends string> = `/api/v1${P}` extends keyof paths
  ? `/api/v1${P}`
  : never;

type JsonOf<T> = T extends { responses: { 200: { content: { 'application/json': infer R } } } }
  ? R
  : never;

/** The 200 JSON body of `GET {path}`, e.g. `GetJson<'/reports/summary'>`. */
export type GetJson<P extends string> =
  paths[Pathify<P>] extends { get: infer Op } ? JsonOf<Op> : never;

/** The 200 JSON body of `POST {path}`. */
export type PostJson<P extends string> =
  paths[Pathify<P>] extends { post: infer Op } ? JsonOf<Op> : never;
