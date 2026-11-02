import type { INodeProperties } from 'n8n-workflow';

const returnAllAndLimit = (resource: string): INodeProperties[] => [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: { resource: [resource], operation: ['getAll'] } },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { resource: [resource], operation: ['getAll'], returnAll: [false] } },
	},
];

// --------------------------------------------------------------------------
// Media
// --------------------------------------------------------------------------

export const mediaOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['media'] } },
		options: [
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete a file from the media library',
				action: 'Delete a media file',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many files from the media library, newest first',
				action: 'Get many media files',
			},
			{
				name: 'Upload',
				value: 'upload',
				description:
					'Upload an image, video or PDF to the media library. Use the returned ID in Post → Create.',
				action: 'Upload a media file',
			},
		],
		default: 'upload',
	},
];

export const mediaFields: INodeProperties[] = [
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		hint: 'The name of the input binary field containing the file to upload',
		description:
			'JPEG, PNG, WebP, GIF, MP4, MOV or PDF. Images up to 10 MB, video and PDFs up to 100 MB.',
		displayOptions: { show: { resource: ['media'], operation: ['upload'] } },
	},
	{
		displayName: 'Media ID',
		name: 'mediaId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'med_…',
		displayOptions: { show: { resource: ['media'], operation: ['delete'] } },
	},
	...returnAllAndLimit('media'),
];

// --------------------------------------------------------------------------
// Channel
// --------------------------------------------------------------------------

export const channelOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['channel'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the connected social accounts you can post to',
				action: 'Get many channels',
			},
		],
		default: 'getAll',
	},
];

export const channelFields: INodeProperties[] = [...returnAllAndLimit('channel')];

// --------------------------------------------------------------------------
// Comment
// --------------------------------------------------------------------------

export const commentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['comment'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get the comments on a published post, read live from the platform',
				action: 'Get many comments',
			},
			{
				name: 'Reply',
				value: 'reply',
				description: 'Reply publicly to a comment on a published post',
				action: 'Reply to a comment',
			},
		],
		default: 'getAll',
	},
];

export const commentFields: INodeProperties[] = [
	{
		displayName: 'Post ID',
		name: 'postId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'pst_…',
		displayOptions: { show: { resource: ['comment'] } },
	},
	{
		displayName: 'Channel Name or ID',
		name: 'channelId',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getChannels' },
		required: true,
		default: '',
		description:
			'Which channel\'s copy of the post the comments are on. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		displayOptions: { show: { resource: ['comment'] } },
	},
	{
		displayName: 'Comment ID',
		name: 'commentId',
		type: 'string',
		required: true,
		default: '',
		description: "The platform's ID for the comment, from Comment → Get Many",
		displayOptions: { show: { resource: ['comment'], operation: ['reply'] } },
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 3 },
		required: true,
		default: '',
		description: 'The reply. It is public as soon as it is posted.',
		displayOptions: { show: { resource: ['comment'], operation: ['reply'] } },
	},
	...returnAllAndLimit('comment'),
];

// --------------------------------------------------------------------------
// Tag
// --------------------------------------------------------------------------

export const tagOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['tag'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: "Get your workspace's tags",
				action: 'Get many tags',
			},
		],
		default: 'getAll',
	},
];

export const tagFields: INodeProperties[] = [...returnAllAndLimit('tag')];
