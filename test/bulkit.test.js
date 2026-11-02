// Runs against the compiled output: `pnpm build && pnpm test`.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');

const { Bulkit } = require('../dist/nodes/Bulkit/Bulkit.node.js');
const { BulkitTrigger, isValidSignature } = require('../dist/nodes/BulkitTrigger/BulkitTrigger.node.js');
const {
	toInstant,
	buildMultipartBody,
	toIdList,
} = require('../dist/nodes/Bulkit/GenericFunctions.js');

const node = { name: 'Bulkit', type: 'n8n-nodes-bulkit.bulkit', typeVersion: 1, parameters: {} };

/** A minimal IExecuteFunctions: parameters per item, and a fake HTTP layer that records calls. */
function makeContext(params, responses = [], { continueOnFail = false, items = [{ json: {} }] } = {}) {
	const calls = [];
	const ctx = {
		calls,
		getInputData: () => items,
		getNode: () => node,
		getTimezone: () => 'Europe/Paris',
		continueOnFail: () => continueOnFail,
		getCredentials: async () => ({ apiKey: 'bk_test_x', baseUrl: 'https://api.example.com/' }),
		getNodeParameter: (name, _i, fallback) => (name in params ? params[name] : fallback),
		helpers: {
			httpRequestWithAuthentication: async (credentialType, options) => {
				calls.push({ credentialType, ...options });
				const next = responses.shift() ?? { statusCode: 200, body: {} };
				return next;
			},
			returnJsonArray: (data) => (Array.isArray(data) ? data : [data]).map((json) => ({ json })),
			constructExecutionMetaData: (items, { itemData }) =>
				items.map((item) => ({ ...item, pairedItem: itemData })),
			assertBinaryData: () => ({ fileName: 'photo.png', mimeType: 'image/png' }),
			getBinaryDataBuffer: async () => Buffer.from('PNGDATA'),
		},
	};
	return ctx;
}

test('toInstant reads a bare date in the workflow time zone', () => {
	assert.equal(toInstant(node, '2026-12-01T09:00:00', 'Europe/Paris'), '2026-12-01T08:00:00.000Z');
	assert.equal(toInstant(node, '2026-07-01T09:00:00', 'Europe/Paris'), '2026-07-01T07:00:00.000Z');
	assert.equal(toInstant(node, '2026-12-01T09:00:00', 'America/New_York'), '2026-12-01T14:00:00.000Z');
	assert.equal(toInstant(node, '2026-12-01T09:00:00Z', 'Asia/Tokyo'), '2026-12-01T09:00:00.000Z');
	assert.equal(toInstant(node, '2026-12-01T09:00:00+02:00', 'UTC'), '2026-12-01T07:00:00.000Z');
	assert.throws(() => toInstant(node, 'tomorrow-ish', 'UTC'), /not a valid date/);
});

test('toIdList accepts comma-separated text and arrays', () => {
	assert.deepEqual(toIdList(' a, b ,,c '), ['a', 'b', 'c']);
	assert.deepEqual(toIdList(['x', ' y ']), ['x', 'y']);
	assert.deepEqual(toIdList(undefined), []);
});

test('buildMultipartBody produces a well-formed part', () => {
	const { body, contentType } = buildMultipartBody('file', 'a"b.png', 'image/png', Buffer.from('BYTES'));
	const boundary = contentType.split('boundary=')[1];
	const text = body.toString('utf8');
	assert.ok(text.startsWith(`--${boundary}\r\n`));
	assert.ok(text.includes('name="file"; filename="a_b.png"'));
	assert.ok(text.includes('Content-Type: image/png\r\n\r\nBYTES\r\n'));
	assert.ok(text.endsWith(`--${boundary}--\r\n`));
});

test('post:create sends one submission with per-channel blocks, thread and schedule', async () => {
	const ctx = makeContext(
		{
			resource: 'post',
			operation: 'create',
			inputMode: 'fields',
			intent: 'schedule',
			scheduledAt: '2026-12-01T09:00:00',
			idempotencyKey: 'run-1',
			channels: {
				channel: [
					{ channelId: 'chn_x', content: 'Hello', thread: ['Part 2', ''], mediaIds: 'med_1, med_2' },
					{ channelId: 'chn_li', content: 'Longer', title: '', options: '{"visibility":"PUBLIC"}' },
				],
			},
			additionalFields: { tagIds: ['tag_1'] },
		},
		[{ statusCode: 201, body: { id: 'pst_1', status: 'scheduled' } }],
	);
	const [out] = await new Bulkit().execute.call(ctx);

	assert.deepEqual(out, [{ json: { id: 'pst_1', status: 'scheduled' }, pairedItem: { item: 0 } }]);
	assert.equal(ctx.calls.length, 1);
	const call = ctx.calls[0];
	assert.equal(call.credentialType, 'bulkitApi');
	assert.equal(call.method, 'POST');
	assert.equal(call.url, 'https://api.example.com/public/v1/posts');
	assert.equal(call.headers['Idempotency-Key'], 'run-1');
	assert.deepEqual(call.body, {
		intent: 'schedule',
		scheduledAt: '2026-12-01T08:00:00.000Z',
		channels: [
			{
				channelId: 'chn_x',
				blocks: [{ content: 'Hello', mediaIds: ['med_1', 'med_2'] }, { content: 'Part 2' }],
			},
			{ channelId: 'chn_li', blocks: [{ content: 'Longer' }], options: { visibility: 'PUBLIC' } },
		],
		tagIds: ['tag_1'],
	});
});

test('post:create rejects a channel with neither text nor media', async () => {
	const ctx = makeContext({
		resource: 'post',
		operation: 'create',
		inputMode: 'fields',
		intent: 'draft',
		channels: { channel: [{ channelId: 'chn_x', content: '' }] },
	});
	await assert.rejects(() => new Bulkit().execute.call(ctx), /needs text or media/);
	assert.equal(ctx.calls.length, 0);
});

test('API errors surface Bulkit code and message; continueOnFail keeps going', async () => {
	const failure = {
		statusCode: 422,
		body: { error: { code: 'content_too_long', message: 'Too long for X', field: 'channels[0]' } },
	};
	const params = { resource: 'post', operation: 'get', postId: 'pst_1' };

	await assert.rejects(
		() => new Bulkit().execute.call(makeContext(params, [failure])),
		(err) => {
			assert.equal(err.name, 'NodeApiError');
			assert.match(err.message, /content_too_long: Too long for X/);
			assert.equal(err.httpCode, '422');
			return true;
		},
	);

	const [out] = await new Bulkit().execute.call(
		makeContext(params, [failure], { continueOnFail: true }),
	);
	assert.match(out[0].json.error, /content_too_long/);
});

test('post:getAll follows the cursor and stops at the limit', async () => {
	const ctx = makeContext(
		{ resource: 'post', operation: 'getAll', returnAll: false, limit: 3, filters: { status: ['failed'] } },
		[
			{ statusCode: 200, body: { data: [{ id: 'a' }, { id: 'b' }], nextCursor: 'c1', hasMore: true } },
			{ statusCode: 200, body: { data: [{ id: 'c' }, { id: 'd' }], nextCursor: 'c2', hasMore: true } },
		],
	);
	const [out] = await new Bulkit().execute.call(ctx);
	assert.deepEqual(out.map((o) => o.json.id), ['a', 'b', 'c']);
	assert.equal(ctx.calls.length, 2);
	assert.deepEqual(ctx.calls[0].qs, { limit: 3, status: ['failed'] });
	assert.deepEqual(ctx.calls[1].qs, { limit: 3, status: ['failed'], cursor: 'c1' });
});

test('media:upload sends multipart bytes', async () => {
	const ctx = makeContext(
		{ resource: 'media', operation: 'upload', binaryPropertyName: 'data' },
		[{ statusCode: 201, body: { id: 'med_1' } }],
	);
	const [out] = await new Bulkit().execute.call(ctx);
	assert.equal(out[0].json.id, 'med_1');
	const call = ctx.calls[0];
	assert.equal(call.url, 'https://api.example.com/public/v1/media');
	assert.equal(call.json, false);
	assert.match(call.headers['Content-Type'], /^multipart\/form-data; boundary=/);
	assert.ok(Buffer.isBuffer(call.body) && call.body.includes('PNGDATA'));
});

test('post:delete returns a confirmation for the 204', async () => {
	const ctx = makeContext({ resource: 'post', operation: 'delete', postId: 'pst_1' }, [
		{ statusCode: 204, body: '' },
	]);
	const [out] = await new Bulkit().execute.call(ctx);
	assert.deepEqual(out[0].json, { id: 'pst_1', deleted: true });
	assert.equal(ctx.calls[0].method, 'DELETE');
});

test('isValidSignature checks HMAC and timestamp', () => {
	const secret = 'whsec_test';
	const body = '{"id":"evt_1","type":"post.published"}';
	const t = 1_800_000_000;
	const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
	assert.equal(isValidSignature(`t=${t},v1=${sig}`, body, secret, t), true);
	assert.equal(isValidSignature(`t=${t},v1=deadbeef,v1=${sig}`, body, secret, t), true);
	assert.equal(isValidSignature(`t=${t},v1=${sig}`, body + ' ', secret, t), false);
	assert.equal(isValidSignature(`t=${t},v1=${sig}`, body, 'wrong', t), false);
	assert.equal(isValidSignature(`t=${t},v1=${sig}`, body, secret, t + 301), false);
	assert.equal(isValidSignature(undefined, body, secret, t), false);
	assert.equal(isValidSignature('garbage', body, secret, t), false);
});

test('trigger registers a webhook, stores the secret, and verifies deliveries', async () => {
	const staticData = {};
	const calls = [];
	const hookCtx = {
		getNode: () => node,
		getWorkflow: () => ({ id: 'wf1', name: 'My flow' }),
		getWorkflowStaticData: () => staticData,
		getNodeWebhookUrl: () => 'https://n8n.example.com/webhook/abc/webhook',
		getNodeParameter: () => ['post.published'],
		getCredentials: async () => ({ apiKey: 'k' }),
		logger: { debug() {} },
		helpers: {
			httpRequestWithAuthentication: async (_c, options) => {
				calls.push(options);
				return { statusCode: 201, body: { secret: 'whsec_1', endpoint: { id: 'wh_1' } } };
			},
		},
	};
	const trigger = new BulkitTrigger();
	assert.equal(await trigger.webhookMethods.default.checkExists.call(hookCtx), false);
	assert.equal(await trigger.webhookMethods.default.create.call(hookCtx), true);
	assert.deepEqual(staticData, { webhookId: 'wh_1', webhookSecret: 'whsec_1' });
	assert.equal(calls[0].url, 'https://api.bulkit.io/public/v1/webhooks');
	assert.deepEqual(calls[0].body, {
		url: 'https://n8n.example.com/webhook/abc/webhook',
		events: ['post.published'],
		description: 'n8n: My flow',
	});

	const event = { id: 'evt_1', type: 'post.published', data: {} };
	const raw = JSON.stringify(event);
	const t = Math.floor(Date.now() / 1000);
	const sig = createHmac('sha256', 'whsec_1').update(`${t}.${raw}`).digest('hex');
	let status;
	const webhookCtx = (header) => ({
		getRequestObject: () => ({ rawBody: Buffer.from(raw), body: event, headers: { 'x-bulkit-signature': header } }),
		getResponseObject: () => ({ status: (s) => ((status = s), { json: () => {} }) }),
		getWorkflowStaticData: () => staticData,
		getBodyData: () => event,
		getNodeParameter: () => ['post.published'],
		helpers: { returnJsonArray: (d) => [{ json: d }] },
	});

	const ok = await trigger.webhook.call(webhookCtx(`t=${t},v1=${sig}`));
	assert.deepEqual(ok.workflowData, [[{ json: event }]]);

	const bad = await trigger.webhook.call(webhookCtx(`t=${t},v1=${'0'.repeat(64)}`));
	assert.equal(bad.noWebhookResponse, true);
	assert.equal(status, 401);
});
