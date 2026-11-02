import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes } from 'n8n-workflow';

import { bulkitApiRequest } from '../Bulkit/GenericFunctions';

const SIGNATURE_HEADER = 'x-bulkit-signature';
const TOLERANCE_SECONDS = 300;

/** Check a `t=<unix>,v1=<hex hmac-sha256 of "<t>.<raw body>">` header. */
export function isValidSignature(
	header: string | undefined,
	rawBody: string,
	secret: string,
	nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
	if (!header) return false;
	let timestamp = Number.NaN;
	const signatures: string[] = [];
	for (const part of header.split(',')) {
		const [key, value] = part.trim().split('=', 2);
		if (key === 't') timestamp = Number(value);
		else if (key === 'v1' && value) signatures.push(value);
	}
	if (!Number.isInteger(timestamp) || signatures.length === 0) return false;
	if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return false;

	const expected = Buffer.from(
		createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex'),
		'utf8',
	);
	return signatures.some((candidate) => {
		const actual = Buffer.from(candidate, 'utf8');
		return actual.length === expected.length && timingSafeEqual(actual, expected);
	});
}

export class BulkitTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bulkit Trigger',
		name: 'bulkitTrigger',
		icon: { light: 'file:../../icons/bulkit.svg', dark: 'file:../../icons/bulkit.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description:
			'Starts the workflow when a Bulkit post publishes or fails, or a social account needs reconnecting',
		defaults: { name: 'Bulkit Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'bulkitApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				options: [
					{
						name: 'Channel Needs Reconnect',
						value: 'channel.needs_reconnect',
						description: 'A social account can no longer publish until someone reconnects it',
					},
					{
						name: 'Post Failed',
						value: 'post.failed',
						description: 'A post failed to publish on a channel',
					},
					{
						name: 'Post Partially Failed',
						value: 'post.partially_failed',
						description: 'Part of a thread published on a channel, then the rest failed',
					},
					{
						name: 'Post Published',
						value: 'post.published',
						description: 'A post went live on a channel',
					},
				],
				default: ['post.published', 'post.failed'],
				description:
					'Post events fire once per channel: a post sent to three networks triggers three times',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				if (!staticData.webhookId) return false;
				try {
					const endpoint = (await bulkitApiRequest.call(
						this,
						'GET',
						`/webhooks/${encodeURIComponent(staticData.webhookId as string)}`,
					)) as IDataObject;
					const events = [...((this.getNodeParameter('events') as string[]) ?? [])].sort();
					const registered = [...((endpoint.events as string[]) ?? [])].sort();
					if (
						endpoint.url === this.getNodeWebhookUrl('default') &&
						events.join() === registered.join() &&
						staticData.webhookSecret
					) {
						return true;
					}
				} catch (error) {
					if ((error as NodeApiError).httpCode !== '404') {
						throw new NodeApiError(this.getNode(), error as JsonObject);
					}
				}
				// Gone, or out of date: forget it so create() registers a fresh one.
				delete staticData.webhookId;
				delete staticData.webhookSecret;
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				if (staticData.webhookId) {
					try {
						await bulkitApiRequest.call(
							this,
							'DELETE',
							`/webhooks/${encodeURIComponent(staticData.webhookId as string)}`,
						);
					} catch (error) {
						// Usually already deleted on Bulkit's side; registering a new one still works.
						this.logger.debug('Bulkit Trigger: could not delete the previous webhook', {
							error: (error as Error).message,
						});
					}
				}
				const workflow = this.getWorkflow();
				const issued = (await bulkitApiRequest.call(this, 'POST', '/webhooks', {
					url: this.getNodeWebhookUrl('default'),
					events: this.getNodeParameter('events') as string[],
					description: `n8n: ${workflow.name ?? workflow.id ?? 'workflow'}`.slice(0, 200),
				})) as { secret?: string; endpoint?: { id?: string } };
				if (!issued.endpoint?.id || !issued.secret) {
					throw new NodeApiError(this.getNode(), issued as JsonObject, {
						message: 'Bulkit did not return a webhook ID and secret',
					});
				}
				staticData.webhookId = issued.endpoint.id;
				staticData.webhookSecret = issued.secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				if (staticData.webhookId) {
					try {
						await bulkitApiRequest.call(
							this,
							'DELETE',
							`/webhooks/${encodeURIComponent(staticData.webhookId as string)}`,
						);
					} catch (error) {
						if ((error as NodeApiError).httpCode !== '404') return false;
					}
				}
				delete staticData.webhookId;
				delete staticData.webhookSecret;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const res = this.getResponseObject();
		const secret = this.getWorkflowStaticData('node').webhookSecret as string | undefined;

		const rawBody =
			(req as { rawBody?: Buffer | string }).rawBody?.toString() ?? JSON.stringify(req.body);
		const header = req.headers[SIGNATURE_HEADER];
		const signature = Array.isArray(header) ? header[0] : header;

		if (!secret || !isValidSignature(signature, rawBody, secret)) {
			res.status(401).json({ error: 'Invalid or missing Bulkit signature' });
			return { noWebhookResponse: true };
		}

		const event = this.getBodyData() as IDataObject;
		const events = this.getNodeParameter('events') as string[];
		if (events.length && !events.includes(event.type as string)) {
			return { webhookResponse: 'ignored' };
		}

		return { workflowData: [this.helpers.returnJsonArray(event)] };
	}
}
