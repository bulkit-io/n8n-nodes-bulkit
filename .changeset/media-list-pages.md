---
"n8n-nodes-bulkit": patch
---

Media > Get Many reads the media library a page at a time, because `GET /media` now returns `{ data, nextCursor, hasMore }` instead of an array. Return All walks every page; Limit stops once it has enough. Older versions of this node fail on Media > Get Many once the API change is live.

Every Get Many that pages (Post, Media, Comment) now stops when the API reports `hasMore: false` or repeats a cursor (an empty page is not the end), and rejects a Limit that is not a whole number of at least 1. Media > Get Many still works against an API that returns a plain array.
