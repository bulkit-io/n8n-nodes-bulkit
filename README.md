# n8n-nodes-bulkit: Bulkit for n8n

[![npm](https://img.shields.io/npm/v/n8n-nodes-bulkit.svg)](https://www.npmjs.com/package/n8n-nodes-bulkit)
[![Bulkit](https://img.shields.io/badge/bulkit.io-social%20media%20scheduler-41af68)](https://bulkit.io?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

**Schedule and publish to X, LinkedIn, Instagram, Facebook, Threads, TikTok, YouTube, Pinterest,
Reddit, Bluesky and Vimeo from your n8n workflows.**

[Bulkit](https://bulkit.io?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node) is a social
media scheduler built for developers, automations and AI agents. Write a post once, tailor it
per network, and Bulkit handles each platform's limits, media rules, threads and retries. This
is the official Bulkit community node for [n8n](https://n8n.io).

**[Start your 14-day free trial →](https://app.bulkit.io/register?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)**
&nbsp;·&nbsp; [Installation](#installation) &nbsp;·&nbsp; [Operations](#operations) &nbsp;·&nbsp;
[Example workflows](#example-workflows)

## What you can build

- **Auto-post from anything n8n connects to:** a new blog post in your RSS feed, a row in Google
  Sheets or Airtable, a Notion page, a Shopify product, a GitHub release
- **Cross-post in one step:** one post to many networks, with a different text for each
- **AI social media workflows:** write posts with an AI node, then schedule them with Bulkit. The
  Bulkit node also works as a tool for n8n's AI Agent.
- **React to results:** start a workflow when a post publishes or fails, or when an account needs
  reconnecting
- **Community management:** read comments and reply to them from a workflow

## Installation

**Self-hosted n8n:** go to **Settings → Community Nodes → Install**, enter `n8n-nodes-bulkit`
and confirm. See n8n's [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
for other methods.

Then search for **Bulkit** in the nodes panel.

## Credentials

1. **Create a Bulkit account.** [Sign up](https://app.bulkit.io/register?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node).
   Every plan starts with a 14-day free trial.
2. **Connect your social accounts** in Bulkit. The
   [workspace setup guide](https://docs.bulkit.io/docs/setup?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)
   walks you through each network.
3. **Create an API key** under **Developers → API & Webhooks**. It is shown once, so copy it
   straight away.
4. **In n8n,** add a **Bulkit API** credential and paste the key. Leave **Base URL** as it is
   unless you run a self-hosted Bulkit.

> **Start with a test key.** A `bk_test_…` key validates every request exactly like a live key,
> but never publishes to a real account and is never billed. Switch to a `bk_live_…` key when
> your workflow is ready. See [Create an API key](https://docs.bulkit.io/docs/api-keys?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node).

## Operations

### Bulkit node

| Resource | Operations |
| -------- | ---------- |
| **Post** | **Create** (save as draft, schedule, or publish now) · **Get** · **Get Many** (filter by status, tag and date) · **Publish** (publish a draft now, or retry a failed post) · **Retract** · **Delete** · **Get Metrics** |
| **Media** | **Upload** (from any binary field) · **Get Many** · **Delete** |
| **Channel** | **Get Many**: your connected social accounts |
| **Comment** | **Get Many** · **Reply** |
| **Tag** | **Get Many** |

**Creating a post.** Add one entry under **Channels** for each account you post to. Each gets its
own text, so LinkedIn can read differently from X, while all of them share one post ID and one
schedule. Per channel you can also attach media, add **Thread Posts** (X, Threads, Bluesky),
set a **Title** (YouTube, Reddit, Pinterest), choose a **Post Type** such as an Instagram story,
and pass **Platform Options** as JSON. For full control, switch **Define Post** to **Using JSON**
and send the API's request body directly.

To attach media, put a **Media → Upload** step before **Post → Create** and use its ID:
`{{ $('Upload').item.json.id }}`.

> **Publishing is asynchronous.** **Publish Now** and **Publish** return as soon as the post is
> queued, with status `publishing`. Use **Post → Get** or the **Bulkit Trigger** to find out
> whether each channel published.

> **Retract and Delete are different.** **Retract** permanently removes the published copies from
> the platforms, likes and replies included. **Delete** only removes the post from Bulkit and
> leaves anything already published live.

### Bulkit Trigger

Starts a workflow on any of these events:

| Event | When |
| ----- | ---- |
| Post Published | A post went live on a channel |
| Post Failed | A post failed to publish on a channel |
| Post Partially Failed | Part of a thread published on a channel, then the rest failed |
| Channel Needs Reconnect | An account can no longer publish until someone reconnects it |

Post events fire **once per channel**: a post sent to three networks triggers three times. The
trigger registers its webhook in Bulkit when you activate the workflow, removes it when you
deactivate it, and rejects any request without a valid Bulkit signature.

Bulkit must be able to reach your n8n instance, so the trigger needs a public `https://` URL.
A local n8n on `localhost` can't receive events; use a tunnel or a hosted instance.

### Anything else

Any other [Bulkit API](https://docs.bulkit.io/docs?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)
endpoint works from n8n's **HTTP Request** node: set **Authentication** to **Predefined Credential
Type**, choose **Bulkit API**, and call `https://api.bulkit.io/public/v1/…`.

## Example workflows

Import these from the [`examples`](./examples) folder (**Workflows → Import from File**):

- [`rss-to-social.json`](./examples/rss-to-social.json): post every new blog article to X and
  LinkedIn, with a different text for each
- [`alert-on-failed-post.json`](./examples/alert-on-failed-post.json): email your team when a
  post fails or an account needs reconnecting

Replace the channel IDs with yours. **Channel → Get Many** lists them.

## Compatibility

Tested with n8n 2.45. Has no runtime dependencies.

## Other ways to use Bulkit

- [Node.js / TypeScript SDK](https://www.npmjs.com/package/bulkit): `npm install bulkit`
- [Command-line interface](https://www.npmjs.com/package/bulkit-cli): `npm install -g bulkit-cli`
- [MCP server for AI agents](https://docs.bulkit.io/docs/guides/mcp?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node):
  let Claude, Cursor and other agents post through Bulkit
- [All supported networks](https://bulkit.io/channels?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)

## Resources

- [Bulkit documentation](https://docs.bulkit.io/docs?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- Questions or a workflow you want supported: [support@bulkit.io](mailto:support@bulkit.io),
  [X](https://x.com/bulkitio), or [open an issue](https://github.com/bulkit-io/n8n-nodes-bulkit/issues)

**New to Bulkit? [Start your 14-day free trial →](https://app.bulkit.io/register?utm_source=npm&utm_medium=readme&utm_campaign=n8n_node)**

## Development

```sh
pnpm install
pnpm dev      # starts n8n on http://localhost:5678 with this node loaded, hot reload
pnpm check    # lint (n8n's rules), typecheck, build, test
```

Releases use [Changesets](https://github.com/changesets/changesets): run `pnpm changeset` and
describe the change. Merging the "Version Packages" PR publishes to npm from GitHub Actions with
provenance.

## License

[MIT](./LICENSE)
