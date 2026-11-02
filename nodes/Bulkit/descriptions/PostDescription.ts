import type { INodeProperties } from 'n8n-workflow';

const showFor = (operation: string[]) => ({ show: { resource: ['post'], operation } });

const postIdField = (operation: string[], description = 'The ID of the post'): INodeProperties => ({
	displayName: 'Post ID',
	name: 'postId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'pst_…',
	description,
	displayOptions: showFor(operation),
});

export const postOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['post'] } },
		options: [
			{
				name: 'Create',
				value: 'create',
				description:
					'Create a post for one or more channels: a draft, a scheduled post, or one published now',
				action: 'Create a post',
			},
			{
				name: 'Delete',
				value: 'delete',
				description:
					'Delete the post from Bulkit only. Anything already published stays live on the platforms.',
				action: 'Delete a post',
			},
			{
				name: 'Get',
				value: 'get',
				description: "Get a post with each channel's status, error and published URL",
				action: 'Get a post',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many posts, newest first',
				action: 'Get many posts',
			},
			{
				name: 'Get Metrics',
				value: 'getMetrics',
				description: 'Get engagement metrics for a published post',
				action: 'Get post metrics',
			},
			{
				name: 'Publish',
				value: 'publish',
				description:
					'Publish a draft or scheduled post now, or retry a failed one. Channels that already published are skipped.',
				action: 'Publish a post',
			},
			{
				name: 'Retract',
				value: 'retract',
				description:
					'Permanently delete the published copies from the platforms, with their likes and replies',
				action: 'Retract a post',
			},
		],
		default: 'create',
	},
];

export const postFields: INodeProperties[] = [
	// ----------------------------------------------------------------------
	// post:create
	// ----------------------------------------------------------------------
	{
		displayName: 'Define Post',
		name: 'inputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Using Fields Below', value: 'fields' },
			{ name: 'Using JSON', value: 'json' },
		],
		default: 'fields',
		displayOptions: showFor(['create']),
	},
	{
		displayName: 'JSON Body',
		name: 'jsonBody',
		type: 'json',
		required: true,
		default:
			'{\n  "intent": "draft",\n  "channels": [\n    { "channelId": "chn_…", "blocks": [{ "content": "Hello from n8n" }] }\n  ]\n}',
		description:
			'The full request body for POST /public/v1/posts. See the Bulkit API reference for every field.',
		displayOptions: { show: { resource: ['post'], operation: ['create'], inputMode: ['json'] } },
	},
	{
		displayName: 'Publish Mode',
		name: 'intent',
		type: 'options',
		options: [
			{
				name: 'Schedule',
				value: 'schedule',
				description: 'Publish at the date and time below',
			},
			{
				name: 'Publish Now',
				value: 'now',
				description:
					'Queue it for publishing straight away. The result arrives later: use Get or the Bulkit Trigger.',
			},
			{
				name: 'Save as Draft',
				value: 'draft',
				description: 'Store it in Bulkit without publishing',
			},
		],
		default: 'schedule',
		displayOptions: { show: { resource: ['post'], operation: ['create'], inputMode: ['fields'] } },
	},
	{
		displayName: 'Scheduled At',
		name: 'scheduledAt',
		type: 'dateTime',
		required: true,
		default: '',
		description:
			"When to publish. A value without a time zone is read in this workflow's time zone.",
		displayOptions: {
			show: {
				resource: ['post'],
				operation: ['create'],
				inputMode: ['fields'],
				intent: ['schedule'],
			},
		},
	},
	{
		displayName: 'Channels',
		name: 'channels',
		type: 'fixedCollection',
		placeholder: 'Add Channel',
		required: true,
		typeOptions: { multipleValues: true, sortable: true },
		default: {},
		description:
			'Where the post goes. Each channel gets its own text, so you can tailor the post per network. All channels share one post ID and one schedule.',
		displayOptions: { show: { resource: ['post'], operation: ['create'], inputMode: ['fields'] } },
		options: [
			{
				displayName: 'Channel',
				name: 'channel',
				values: [
					{
						displayName: 'Channel Name or ID',
						name: 'channelId',
						type: 'options',
						typeOptions: { loadOptionsMethod: 'getChannels' },
						required: true,
						default: '',
						description:
							'A connected social account. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
					{
						displayName: 'Media IDs',
						name: 'mediaIds',
						type: 'string',
						default: '',
						placeholder: 'med_123, med_456',
						description:
							'Comma-separated media IDs from the Media → Upload operation, in the order they should appear',
					},
					{
						displayName: 'Platform Options (JSON)',
						name: 'options',
						type: 'json',
						default: '{}',
						description:
							'Fields that belong to this platform alone. Examples: privacy_level on TikTok, link on Pinterest. See the platform limits in the Bulkit docs.',
					},
					{
						displayName: 'Post Type',
						name: 'postType',
						type: 'string',
						default: '',
						placeholder: 'story',
						description:
							'For platforms that publish more than one kind of post, such as an Instagram story. Leave empty for a normal post.',
					},
					{
						displayName: 'Text',
						name: 'content',
						type: 'string',
						typeOptions: { rows: 4 },
						default: '',
						description:
							"The post's text. Can be empty when media is attached. Each platform's character limit applies.",
					},
					{
						displayName: 'Thread Posts',
						name: 'thread',
						type: 'string',
						typeOptions: { multipleValues: true, rows: 2 },
						default: [],
						description:
							'More posts that follow the first one as a thread, in order. Only on platforms that support threads, such as X, Threads and Bluesky.',
					},
					{
						displayName: 'Title',
						name: 'title',
						type: 'string',
						default: '',
						description:
							'Only for platforms that have a title, such as YouTube, Reddit or Pinterest',
					},
				],
			},
		],
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { resource: ['post'], operation: ['create'], inputMode: ['fields'] } },
		options: [
			{
				displayName: 'Tag Names or IDs',
				name: 'tagIds',
				type: 'multiOptions',
				typeOptions: { loadOptionsMethod: 'getTags' },
				default: [],
				description:
					'Your workspace\'s own labels for this post. They are never published. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
		],
	},
	{
		displayName: 'Idempotency Key',
		name: 'idempotencyKey',
		type: 'string',
		default: '',
		description:
			'Optional. Sending the same key again returns the original post instead of creating a duplicate, which makes retries safe.',
		displayOptions: showFor(['create']),
	},

	// ----------------------------------------------------------------------
	// post:get / delete / publish / retract / getMetrics
	// ----------------------------------------------------------------------
	postIdField(['get', 'getMetrics']),
	postIdField(['publish'], 'The ID of the draft, scheduled or failed post to publish'),
	postIdField(
		['retract'],
		'The ID of the post to take down. This cannot be undone. Channels that cannot be retracted are listed under "remaining".',
	),
	postIdField(['delete'], 'The ID of the post to remove from Bulkit'),

	// ----------------------------------------------------------------------
	// post:getAll
	// ----------------------------------------------------------------------
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: showFor(['getAll']),
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: ['post'], operation: ['getAll'], returnAll: [false] } },
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: showFor(['getAll']),
		options: [
			{
				displayName: 'From',
				name: 'from',
				type: 'dateTime',
				default: '',
				description: 'Only posts scheduled at or after this time',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				options: [
					{ name: 'Draft', value: 'draft' },
					{ name: 'Failed', value: 'failed' },
					{ name: 'Published', value: 'published' },
					{ name: 'Publishing', value: 'publishing' },
					{ name: 'Scheduled', value: 'scheduled' },
				],
				default: [],
			},
			{
				displayName: 'Tag Names or IDs',
				name: 'tag',
				type: 'multiOptions',
				typeOptions: { loadOptionsMethod: 'getTags' },
				default: [],
				description:
					'Posts carrying any of these tags. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'To',
				name: 'to',
				type: 'dateTime',
				default: '',
				description: 'Only posts scheduled at or before this time',
			},
		],
	},
];
