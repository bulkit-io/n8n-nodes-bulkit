import type {
	IDataObject,
	IExecuteFunctions,
	JsonObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import {
	channelFields,
	channelOperations,
	commentFields,
	commentOperations,
	mediaFields,
	mediaOperations,
	tagFields,
	tagOperations,
} from './descriptions/OtherDescriptions';
import { postFields, postOperations } from './descriptions/PostDescription';
import {
	bulkitApiRequest,
	bulkitApiRequestAllItems,
	buildMultipartBody,
	getChannelOptions,
	getTagOptions,
	parseJson,
	toIdList,
	toInstant,
} from './GenericFunctions';

interface ChannelInput {
	channelId: string;
	content?: string;
	mediaIds?: string;
	thread?: string[] | string;
	title?: string;
	postType?: string;
	options?: string | IDataObject;
}

export class Bulkit implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Bulkit',
		name: 'bulkit',
		icon: { light: 'file:../../icons/bulkit.svg', dark: 'file:../../icons/bulkit.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Schedule and publish social media posts to X, LinkedIn, Instagram, Facebook, Threads, TikTok, YouTube, Pinterest, Reddit and Bluesky',
		defaults: { name: 'Bulkit' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'bulkitApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Channel', value: 'channel' },
					{ name: 'Comment', value: 'comment' },
					{ name: 'Media', value: 'media' },
					{ name: 'Post', value: 'post' },
					{ name: 'Tag', value: 'tag' },
				],
				default: 'post',
			},
			...postOperations,
			...postFields,
			...mediaOperations,
			...mediaFields,
			...channelOperations,
			...channelFields,
			...commentOperations,
			...commentFields,
			...tagOperations,
			...tagFields,
		],
	};

	methods = {
		loadOptions: {
			getChannels: getChannelOptions,
			getTags: getTagOptions,
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let result: IDataObject | IDataObject[];

				if (resource === 'post') {
					result = await executePost.call(this, operation, i);
				} else if (resource === 'media') {
					result = await executeMedia.call(this, operation, i);
				} else if (resource === 'channel') {
					result = await limitList.call(
						this,
						(await bulkitApiRequest.call(
							this,
							'GET',
							'/channels',
							undefined,
							{},
							{},
							i,
						)) as IDataObject[],
						i,
					);
				} else if (resource === 'comment') {
					result = await executeComment.call(this, operation, i);
				} else if (resource === 'tag') {
					result = await limitList.call(
						this,
						(await bulkitApiRequest.call(
							this,
							'GET',
							'/tags',
							undefined,
							{},
							{},
							i,
						)) as IDataObject[],
						i,
					);
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown resource "${resource}"`, {
						itemIndex: i,
					});
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(result),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				// Both constructors hand back an existing error of their own class unchanged.
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

async function limitList(
	this: IExecuteFunctions,
	list: IDataObject[],
	i: number,
): Promise<IDataObject[]> {
	const returnAll = this.getNodeParameter('returnAll', i) as boolean;
	if (returnAll) return list;
	return list.slice(0, this.getNodeParameter('limit', i) as number);
}

async function executePost(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject | IDataObject[]> {
	if (operation === 'create') {
		const headers: IDataObject = {};
		const options = this.getNodeParameter('options', i, {}) as IDataObject;
		const idempotencyKey = ((options.idempotencyKey as string | undefined) ?? '').trim();
		if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

		const inputMode = this.getNodeParameter('inputMode', i) as string;
		if (inputMode === 'json') {
			const body = parseJson(this.getNode(), this.getNodeParameter('jsonBody', i), 'JSON Body', i);
			return await bulkitApiRequest.call(this, 'POST', '/posts', body, {}, headers, i);
		}

		const intent = this.getNodeParameter('intent', i) as string;
		const channelsInput = (this.getNodeParameter('channels', i, {}) as { channel?: ChannelInput[] })
			.channel;
		if (!channelsInput?.length) {
			throw new NodeOperationError(this.getNode(), 'Add at least one channel', { itemIndex: i });
		}

		const channels = channelsInput.map((c, index) => {
			const mediaIds = toIdList(c.mediaIds);
			const first: IDataObject = {};
			if (c.content) first.content = c.content;
			if (mediaIds.length) first.mediaIds = mediaIds;
			if (!first.content && !mediaIds.length) {
				throw new NodeOperationError(this.getNode(), `Channel ${index + 1} needs text or media`, {
					itemIndex: i,
				});
			}
			const thread = (Array.isArray(c.thread) ? c.thread : c.thread ? [c.thread] : [])
				.map((t) => String(t))
				.filter((t) => t.trim() !== '')
				.map((content) => ({ content }));

			const channel: IDataObject = { channelId: c.channelId, blocks: [first, ...thread] };
			if (c.title) channel.title = c.title;
			if (c.postType) channel.postType = c.postType;
			const options = parseJson(
				this.getNode(),
				c.options,
				`Platform Options of channel ${index + 1}`,
				i,
			);
			if (Object.keys(options).length) channel.options = options;
			return channel;
		});

		const body: IDataObject = { intent, channels };
		if (intent === 'schedule') {
			body.scheduledAt = toInstant(
				this.getNode(),
				this.getNodeParameter('scheduledAt', i),
				this.getTimezone(),
				i,
			);
		}
		const additional = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
		const tagIds = toIdList(additional.tagIds);
		if (tagIds.length) body.tagIds = tagIds;

		return await bulkitApiRequest.call(this, 'POST', '/posts', body, {}, headers, i);
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', i) as boolean;
		const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
		const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
		const qs: IDataObject = { limit: Math.min(limit ?? 100, 100) };
		const timeZone = this.getTimezone();
		if (filters.from) qs.from = toInstant(this.getNode(), filters.from, timeZone, i);
		if (filters.to) qs.to = toInstant(this.getNode(), filters.to, timeZone, i);
		if ((filters.status as string[] | undefined)?.length) qs.status = filters.status;
		const tags = toIdList(filters.tag);
		if (tags.length) qs.tag = tags;
		return await bulkitApiRequestAllItems.call(this, '/posts', qs, limit, i);
	}

	const postId = encodeURIComponent((this.getNodeParameter('postId', i) as string).trim());

	switch (operation) {
		case 'get':
			return await bulkitApiRequest.call(this, 'GET', `/posts/${postId}`, undefined, {}, {}, i);
		case 'getMetrics':
			return await bulkitApiRequest.call(
				this,
				'GET',
				`/posts/${postId}/metrics`,
				undefined,
				{},
				{},
				i,
			);
		case 'publish':
			return await bulkitApiRequest.call(
				this,
				'POST',
				`/posts/${postId}/publish`,
				undefined,
				{},
				{},
				i,
			);
		case 'retract':
			return await bulkitApiRequest.call(
				this,
				'POST',
				`/posts/${postId}/retract`,
				undefined,
				{},
				{},
				i,
			);
		case 'delete':
			await bulkitApiRequest.call(this, 'DELETE', `/posts/${postId}`, undefined, {}, {}, i);
			return { id: decodeURIComponent(postId), deleted: true };
		default:
			throw new NodeOperationError(this.getNode(), `Unknown operation "${operation}"`, {
				itemIndex: i,
			});
	}
}

async function executeMedia(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject | IDataObject[]> {
	if (operation === 'upload') {
		const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
		const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
		const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
		const { body, contentType } = buildMultipartBody(
			'file',
			binaryData.fileName ?? `upload.${binaryData.fileExtension ?? 'bin'}`,
			binaryData.mimeType || 'application/octet-stream',
			buffer,
		);
		return await bulkitApiRequest.call(
			this,
			'POST',
			'/media',
			body,
			{},
			{ 'Content-Type': contentType },
			i,
		);
	}
	if (operation === 'getAll') {
		return await limitList.call(
			this,
			(await bulkitApiRequest.call(this, 'GET', '/media', undefined, {}, {}, i)) as IDataObject[],
			i,
		);
	}
	if (operation === 'delete') {
		const mediaId = (this.getNodeParameter('mediaId', i) as string).trim();
		await bulkitApiRequest.call(
			this,
			'DELETE',
			`/media/${encodeURIComponent(mediaId)}`,
			undefined,
			{},
			{},
			i,
		);
		return { id: mediaId, deleted: true };
	}
	throw new NodeOperationError(this.getNode(), `Unknown operation "${operation}"`, {
		itemIndex: i,
	});
}

async function executeComment(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject | IDataObject[]> {
	const postId = encodeURIComponent((this.getNodeParameter('postId', i) as string).trim());
	const channelId = this.getNodeParameter('channelId', i) as string;

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', i) as boolean;
		const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
		return await bulkitApiRequestAllItems.call(
			this,
			`/posts/${postId}/comments`,
			{ channelId },
			limit,
			i,
		);
	}
	if (operation === 'reply') {
		const commentId = encodeURIComponent((this.getNodeParameter('commentId', i) as string).trim());
		const text = this.getNodeParameter('text', i) as string;
		return await bulkitApiRequest.call(
			this,
			'POST',
			`/posts/${postId}/comments/${commentId}/replies`,
			{ channelId, text },
			{},
			{},
			i,
		);
	}
	throw new NodeOperationError(this.getNode(), `Unknown operation "${operation}"`, {
		itemIndex: i,
	});
}
