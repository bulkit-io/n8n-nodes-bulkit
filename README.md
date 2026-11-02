# n8n-nodes-bulkit: Bulkit for n8n

[![npm](https://img.shields.io/npm/v/n8n-nodes-bulkit.svg)](https://www.npmjs.com/package/n8n-nodes-bulkit)
[![Bulkit](https://img.shields.io/badge/bulkit.io-social%20media%20scheduler-blue)](https://bulkit.io?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

**Schedule and publish to X, LinkedIn, Instagram, Facebook, Threads, TikTok, YouTube, Pinterest,
Reddit, Bluesky and Vimeo from your n8n workflows.**

[Bulkit](https://bulkit.io?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node) is a social
media scheduler built for developers, automations and AI agents. Write a post once, tailor it
per network, and Bulkit handles each platform's limits, media rules, threads and retries. This
package will be the official Bulkit community node for [n8n](https://n8n.io).

**[Start your 14-day free trial →](https://app.bulkit.io/register?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)**
&nbsp;·&nbsp; [Use Bulkit in n8n today](#use-bulkit-in-n8n-today) &nbsp;·&nbsp;
[Documentation](https://docs.bulkit.io/docs?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)

> **Status: coming soon.** The node itself is not released yet, so this version installs
> nothing into n8n. You can already automate Bulkit from n8n with the HTTP Request node, as
> shown below. [Watch this repository](https://github.com/bulkit-io/n8n-nodes-bulkit) to hear
> about the first release.

## What you will be able to do

- **Auto-post from anything n8n connects to:** a new blog post in your RSS feed, a row in Google
  Sheets or Airtable, a Notion page, a Shopify product, a GitHub release
- **Cross-post in one step:** one submission to many networks, with a different text for each
- **Schedule or publish now,** with images, video and threads
- **AI social media workflows:** generate posts with an AI node, then schedule them with Bulkit
- **React to results:** trigger workflows when a post publishes or fails (Bulkit webhooks)
- **Reply to comments** and pull post metrics into your reports

## Use Bulkit in n8n today

Until the node ships, the [Bulkit API](https://docs.bulkit.io/docs?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)
works from n8n's built-in **HTTP Request** node.

1. **Create a Bulkit account.** [Sign up](https://app.bulkit.io/register?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node).
   Every plan starts with a 14-day free trial.
2. **Connect your social accounts** in the app. The
   [workspace setup guide](https://docs.bulkit.io/docs/setup?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)
   walks you through each network.
3. **Create an API key** under **Developers → API & Webhooks**. Start with a `bk_test_…` key: it
   validates every request like a live key but never publishes and is never billed.
4. **Add a credential in n8n:** _Header Auth_, name `x-api-key`, value your key.
5. **List your channels** with an HTTP Request node: `GET https://api.bulkit.io/public/v1/channels`.
   Each channel has the `id` you post to.
6. **Schedule a post** with another HTTP Request node:

   - Method: `POST`
   - URL: `https://api.bulkit.io/public/v1/posts`
   - Authentication: the Header Auth credential from step 4
   - Body (JSON):

   ```json
   {
     "intent": "schedule",
     "scheduledAt": "2026-12-01T09:00:00Z",
     "channels": [
       { "channelId": "chn_x", "blocks": [{ "content": "Shipping today." }] },
       { "channelId": "chn_li", "blocks": [{ "content": "A longer version, for LinkedIn." }] }
     ]
   }
   ```

Send **one** request with several entries in `channels`, not one request per channel. Use
`"intent": "now"` to publish straight away; publishing is asynchronous, so check the result with
`GET /public/v1/posts/{id}` or a webhook. See the
[API reference](https://docs.bulkit.io/docs?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)
for media uploads, threads, comments and webhooks.

## Other ways to use Bulkit

- [Node.js / TypeScript SDK](https://www.npmjs.com/package/bulkit): `npm install bulkit`
- [Command-line interface](https://www.npmjs.com/package/bulkit-cli): `npm install -g bulkit-cli`
- [MCP server for AI agents](https://docs.bulkit.io/docs/guides/mcp?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node):
  let Claude, Cursor and other agents post through Bulkit
- [All supported networks](https://bulkit.io/channels?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)

## Links

- Website: [bulkit.io](https://bulkit.io?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)
- Docs: [docs.bulkit.io](https://docs.bulkit.io/docs?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)
- Questions or a workflow you want supported: [support@bulkit.io](mailto:support@bulkit.io),
  [X](https://x.com/bulkitio), or [open an issue](https://github.com/bulkit-io/n8n-nodes-bulkit/issues)

**New to Bulkit? [Start your 14-day free trial →](https://app.bulkit.io/register?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)**

## License

[MIT](./LICENSE)
