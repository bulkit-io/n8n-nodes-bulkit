import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	INode,
	INodePropertyOptions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

type BulkitContext = IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions | IWebhookFunctions;

const DEFAULT_BASE_URL = 'https://api.bulkit.io';

interface FullResponse {
	statusCode: number;
	body: unknown;
}

async function getBaseUrl(this: BulkitContext): Promise<string> {
	const credentials = await this.getCredentials('bulkitApi');
	const baseUrl = (credentials.baseUrl as string | undefined)?.trim() || DEFAULT_BASE_URL;
	return baseUrl.replace(/\/+$/, '');
}

/**
 * Call the Bulkit public API. Every failure arrives as `{ error: { code, message, field? } }`,
 * which is turned into a NodeApiError that shows Bulkit's own message.
 */
export async function bulkitApiRequest(
	this: BulkitContext,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject | Buffer,
	qs: IDataObject = {},
	headers: IDataObject = {},
	itemIndex?: number,
): Promise<IDataObject | IDataObject[]> {
	const options: IHttpRequestOptions = {
		method,
		url: `${await getBaseUrl.call(this)}/public/v1${endpoint}`,
		qs,
		headers,
		json: !Buffer.isBuffer(body),
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
		arrayFormat: 'repeat',
	};
	if (body !== undefined) options.body = body;

	let response: FullResponse;
	try {
		response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'bulkitApi',
			options,
		)) as FullResponse;
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex });
	}

	let data = response.body;
	if (Buffer.isBuffer(data)) data = data.toString('utf8');
	if (typeof data === 'string' && data.length > 0) {
		try {
			data = JSON.parse(data);
		} catch {
			// Not JSON (e.g. a proxy's HTML error page); keep the text.
		}
	}

	if (response.statusCode >= 400) {
		const detail = (data as { error?: { code?: string; message?: string; field?: string } })?.error;
		const message = detail?.message ?? `Bulkit returned HTTP ${response.statusCode}`;
		throw new NodeApiError(this.getNode(), (data ?? {}) as JsonObject, {
			itemIndex,
			httpCode: String(response.statusCode),
			message: detail?.code ? `${detail.code}: ${message}` : message,
			description: detail?.field ? `Field: ${detail.field}` : undefined,
		});
	}

	return (data === '' || data === undefined ? {} : data) as IDataObject | IDataObject[];
}

/** Follow `nextCursor` until the end, or until `limit` items have been collected. */
export async function bulkitApiRequestAllItems(
	this: IExecuteFunctions | ILoadOptionsFunctions,
	endpoint: string,
	qs: IDataObject = {},
	limit?: number,
	itemIndex?: number,
): Promise<IDataObject[]> {
	const results: IDataObject[] = [];
	let cursor: string | null | undefined;
	do {
		const query: IDataObject = { ...qs };
		if (cursor) query.cursor = cursor;
		const page = (await bulkitApiRequest.call(
			this,
			'GET',
			endpoint,
			undefined,
			query,
			{},
			itemIndex,
		)) as { data?: IDataObject[]; nextCursor?: string | null };
		results.push(...(page.data ?? []));
		cursor = page.nextCursor;
		if (limit !== undefined && results.length >= limit) return results.slice(0, limit);
	} while (cursor);
	return results;
}

/** Build a multipart/form-data body by hand, so no form library is needed. */
export function buildMultipartBody(
	fieldName: string,
	fileName: string,
	mimeType: string,
	data: Buffer,
): { body: Buffer; contentType: string } {
	const boundary = `----n8nBulkit${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
	const safeName = fileName.replace(/["\r\n]/g, '_');
	const head = Buffer.from(
		`--${boundary}\r\n` +
			`Content-Disposition: form-data; name="${fieldName}"; filename="${safeName}"\r\n` +
			`Content-Type: ${mimeType}\r\n\r\n`,
		'utf8',
	);
	const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
	return {
		body: Buffer.concat([head, data, tail]),
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}

/** Split "a, b ,c" or an array into clean ids. */
export function toIdList(value: unknown): string[] {
	if (Array.isArray(value))
		return value
			.map(String)
			.map((v) => v.trim())
			.filter(Boolean);
	if (typeof value === 'string') {
		return value
			.split(',')
			.map((v) => v.trim())
			.filter(Boolean);
	}
	return [];
}

export async function getChannelOptions(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const channels = (await bulkitApiRequest.call(this, 'GET', '/channels')) as Array<{
		id: string;
		platform: string;
		name: string;
		username?: string | null;
		needsReconnect?: boolean;
	}>;
	return channels.map((channel) => {
		const handle = channel.username ? ` (@${channel.username.replace(/^@/, '')})` : '';
		const warning = channel.needsReconnect ? ' [needs reconnect]' : '';
		return {
			name: `${channel.platform}: ${channel.name}${handle}${warning}`,
			value: channel.id,
		};
	});
}

export async function getTagOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const tags = (await bulkitApiRequest.call(this, 'GET', '/tags')) as Array<{
		id: string;
		name: string;
	}>;
	return tags.map((tag) => ({ name: tag.name, value: tag.id }));
}

/**
 * Turn a dateTime parameter into an ISO 8601 instant. A value without an offset (what n8n's date
 * picker produces) is read in the given IANA time zone.
 */
export function toInstant(
	node: INode,
	value: unknown,
	timeZone: string,
	itemIndex?: number,
): string {
	const text = String(value).trim();
	if (/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(text)) return new Date(text).toISOString();

	const match =
		/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/.exec(text);
	if (!match) {
		const parsed = new Date(text);
		if (Number.isNaN(parsed.getTime()))
			throw new NodeOperationError(node, `"${text}" is not a valid date`, { itemIndex });
		return parsed.toISOString();
	}
	const [, y, mo, d, h = '0', mi = '0', s = '0', ms = '0'] = match;
	const wallClock = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, +ms.padEnd(3, '0'));

	const offsetAt = (instant: number): number => {
		const parts = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		}).formatToParts(new Date(instant));
		const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
		const asUtc = Date.UTC(
			get('year'),
			get('month') - 1,
			get('day'),
			get('hour'),
			get('minute'),
			get('second'),
		);
		return asUtc - Math.floor(instant / 1000) * 1000;
	};

	let instant = wallClock - offsetAt(wallClock);
	instant = wallClock - offsetAt(instant);
	return new Date(instant).toISOString();
}

export function parseJson(
	node: INode,
	value: unknown,
	what: string,
	itemIndex?: number,
): IDataObject {
	if (value === undefined || value === null || value === '') return {};
	if (typeof value === 'object') return value as IDataObject;
	try {
		return JSON.parse(String(value)) as IDataObject;
	} catch {
		throw new NodeOperationError(node, `${what} is not valid JSON`, { itemIndex });
	}
}
