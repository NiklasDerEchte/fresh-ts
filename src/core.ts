import { APIError, APIResponse, AuthenticationError, FreshRSSOptions, PlainObject } from './types';
import crypto from 'crypto';

export class APICore {
  private readonly apiEndpoint: string;
  private readonly debug: boolean;
  private readonly apiKey: string;

  constructor(options: FreshRSSOptions) {
    let host = options.host || process.env.FRESHRSS_API_HOST;
    let username = options.username || process.env.FRESHRSS_API_USERNAME;
    let password = options.password || process.env.FRESHRSS_API_PASSWORD;
    this.debug = options.debug ?? false;

    if (!host) {
      throw new Error('Host URL is required. Provide it as an argument or set FRESHRSS_API_HOST environment variable.');
    }
    if (!username) {
      throw new Error('Username is required. Provide it as an argument or set FRESHRSS_API_USERNAME environment variable.');
    }
    if (!password) {
      throw new Error('Password is required. Provide it as an argument or set FRESHRSS_API_PASSWORD environment variable.');
    }
    if(!host.endsWith("/")) host += "/";
    this.apiEndpoint = `${host}api/fever.php`;
    if(this.debug) console.log(`Using FreshRSS API endpoint: ${this.apiEndpoint}`);
    this.apiKey = crypto.createHash('md5').update(`${username}:${password}`).digest('hex');
    this.authenticate();
  }

  /**
   * Initialize authentication check asynchronously
   */
  private async authenticate(): Promise<void> {
    const response = await this.request('api');
    if (!response?.auth) {
      throw new AuthenticationError('Failed to authenticate with FreshRSS API');
    }
  }

  /**
   * Makes an API call to the FreshRSS server
   */
  public async request(endpoint: string = 'api', params: PlainObject = {}): Promise<APIResponse> {
    const data = { api_key: this.apiKey };

    // Build query parameters
    const queryParams: PlainObject = { api: '' };
    if (endpoint !== 'api') {
      queryParams[endpoint] = '';
    }
    Object.assign(queryParams, params);

    if ('as_' in queryParams) {
      queryParams['as'] = queryParams['as_'];
      delete queryParams['as_'];
    }

    if (this.debug) {
      console.info('API request:', this.apiEndpoint);
      console.info('Query parameters:', queryParams);
    }

    return await this.execute(queryParams, data);
  }

  /**
   * Executes the HTTP request using axios or fetch as fallback
   */
  private async execute(queryParams: PlainObject, data: PlainObject): Promise<APIResponse> {
    const url = new URL(this.apiEndpoint);
    Object.keys(queryParams).forEach((key) => {
      url.searchParams.set(key, String(queryParams[key]));
    });

    const body = new URLSearchParams(data).toString();

    const fetchImpl = (globalThis as any).fetch;
    const response = await fetchImpl(url.toString(), {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new APIError(`HTTP ${response.status} ${response.statusText}: ${text}`);
    }

    const result = await response.json().catch((error: any) => {
      throw error;
    });

    if (!result?.auth) {
      throw new AuthenticationError('Invalid API credentials');
    }

    if (this.debug) console.info('API response:', result);
    return result;
  }
}