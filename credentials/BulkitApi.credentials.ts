import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class BulkitApi implements ICredentialType {
	name = 'bulkitApi';

	displayName = 'Bulkit API';

	icon: Icon = { light: 'file:../icons/bulkit.svg', dark: 'file:../icons/bulkit.dark.svg' };

	documentationUrl = 'https://docs.bulkit.io/docs/api-keys';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			description:
				'Create one in Bulkit under Developers → API & Webhooks. Start with a bk_test_ key: it validates everything but never publishes and is never billed.',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.bulkit.io',
			description: 'Only change this for a self-hosted Bulkit instance',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{($credentials.baseUrl || "https://api.bulkit.io").replace(/\\/+$/, "")}}',
			url: '/public/v1/channels',
			method: 'GET',
		},
	};
}
