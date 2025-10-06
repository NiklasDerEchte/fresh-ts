import { APICore, APIError, APIResponse, AuthenticationError, FreshRSSOptions, PlainObject } from '../types';
import crypto from 'crypto';

export class GreaderAPICore implements APICore {
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
    if (!host.endsWith("/")) host += "/";
    this.apiEndpoint = `${host}api/greader.php`;
    if (this.debug) console.log(`Using FreshRSS API endpoint: ${this.apiEndpoint}`);
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
    return {};
  }
}