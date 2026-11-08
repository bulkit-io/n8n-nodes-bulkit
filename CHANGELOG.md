# n8n-nodes-bulkit

## 0.2.1

### Patch Changes

- a48b415: List Vimeo among the supported networks in the package and node descriptions.

## 0.2.0

### Minor Changes

- c40ee2d: Move Idempotency Key on Post > Create into a new Options collection, as required by the n8n verified-node review. Workflows that set the old top-level Idempotency Key need to set it again under Options.

### Patch Changes

- 8c42f54: Show a clean homepage link on npm by dropping the UTM parameters from the package homepage URL.

## 0.1.2

### Patch Changes

- 8022688: Use contact@bulkit.io as the package contact address.

## 0.1.1

### Patch Changes

- 14eec32: Publish with an npm provenance attestation, which n8n requires for verified community nodes. No code changes.

## 0.1.0

### Minor Changes

- 9bad2fa: First release of the Bulkit nodes for n8n.
  - **Bulkit** node: create, get, list, publish, retract and delete posts, get post metrics, upload and manage media, list channels and tags, and read and reply to comments.
  - **Bulkit Trigger** node: start a workflow when a post publishes, fails or partially fails on a channel, or when a channel needs reconnecting. The webhook is registered automatically and every delivery's signature is verified.
