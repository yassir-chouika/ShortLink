# API status

Phase 0 defines **no API endpoints**. The `/` route serves the introduction page;
it does not create or resolve short links. No database schema, redirect route,
analytics collection, or QR-code endpoint exists yet.

## Tentative routes for later phases

These are design notes, not an implemented API contract:

| Method | Tentative route           | Intended purpose                                               |
| ------ | ------------------------- | -------------------------------------------------------------- |
| `POST` | `/api/links`              | Validate an HTTP(S) destination and create a short link.       |
| `GET`  | `/<code>`                 | Resolve a short code and redirect to its stored destination.   |
| `GET`  | `/api/links/<code>/stats` | Return aggregate click data with an appropriate access policy. |

Route names, request and response schemas, status codes, redirect caching, limits,
and access controls will be finalized alongside implementation and meaningful
tests. In particular, analytics must not expose private data simply because a
short code is public. QR generation is intended to run locally, without a paid
QR-code service.

When an endpoint is added, document its validation rules, success and failure
examples, response codes, security requirements, and automated verification here.
