---
"n8n-nodes-bulkit": patch
---

Media > Get Many reads the media library a page at a time, because `GET /media` now returns `{ data, nextCursor, hasMore }` instead of an array. Return All walks every page; Limit stops once it has enough. Older versions of this node fail on Media > Get Many once the API change is live.
