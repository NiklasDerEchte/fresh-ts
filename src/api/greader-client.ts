import { AuthenticationError, FreshRSSOptions, HttpMethod } from "../types";
import { HttpService } from './http';

// curl 'https://freshrss.example.net/api/greader.php/accounts/ClientLogin?Email=alice&Passwd=Abcdef123456'
// SID=alice/8e6845e089457af25303abc6f53356eb60bdb5f8
// Auth=alice/8e6845e089457af25303abc6f53356eb60bdb5f8

// curl -s -H "Authorization:GoogleLogin auth=alice/8e6845e089457af25303abc6f53356eb60bdb5f8" \
//   'https://freshrss.example.net/api/greader.php/reader/api/0/tag/list?output=json'

export class GreaderClient {

  private httpService: HttpService;
  private sessionToken: string | undefined;

  /**
   * Creates an instance of GreaderClient.
   * @param apiEndpoint 
   * @param username
   * @param password
   * @param debug 
   */
  constructor(
    private apiEndpoint: string,
    private username: string,
    private password: string,
    private debug = false
  ) {
    this.httpService = new HttpService(debug);
   }

  /**
   * Factory method to create and authenticate a GreaderClient instance
   * @param options FreshRSSOptions
   * @returns Promise<GreaderClient>
   */
  static async create(options: FreshRSSOptions): Promise<GreaderClient> {
    let host = options.host || process.env.FRESHRSS_API_HOST;
    let username = options.username || process.env.FRESHRSS_API_USERNAME;
    let password = options.password || process.env.FRESHRSS_API_PASSWORD;
    let debug = options.debug ?? false;
    if (!host) {
      throw new Error('Host URL is required. Provide it as an argument or set FRESHRSS_API_HOST environment variable.');
    }
    if (!username) {
      throw new Error('Username is required. Provide it as an argument or set FRESHRSS_API_USERNAME environment variable.');
    }
    if (!password) {
      throw new Error('Password is required. Provide it as an argument or set FRESHRSS_API_PASSWORD environment variable.');
    }
    if (!host.endsWith("/")) {
      host += "/";
    }
    let apiEndpoint = `${host}api/greader.php`;
    if (debug) console.log(`Using FreshRSS API endpoint: ${apiEndpoint}`);
    const client = new GreaderClient(apiEndpoint, username, password, debug);
    await client.authenticate();
    return client;
  }

  /**
   * Initialize authentication check asynchronously
   * @throws AuthenticationError if authentication fails
   * @returns Promise<void>
   */
  private async authenticate(): Promise<void> {
    const response = await this.httpService.request<string>({
      url: this.httpService.urlForge(this.apiEndpoint, '/accounts/ClientLogin'),
      method: HttpMethod.POST,
      urlSearchParams: { Email: this.username, Passwd: this.password }
    });
    if (this.debug) console.log('Authentication response:', response);
    let {
      SID: sid = undefined,
      LSID: lsid = undefined,
      Auth: auth = undefined
    } = this.parseAuthResponse(response ?? '');
    if (!auth) {
      throw new AuthenticationError('Failed to authenticate with FreshRSS API');
    }
    let token = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, '/reader/api/0/token'),
      method: HttpMethod.GET,
      headers: {
        Authorization: `GoogleLogin auth=${auth}`
      }
    });
    if(!token) {
      throw new AuthenticationError('Failed to retrieve session token from FreshRSS API');
    }
    this.sessionToken = token;
  }

  /**
   * Parse authentication response string into key-value pairs
   * Example:
   *   SID=12345
   *   LSID=67890
   *   Auth=abcdef
   * @param responseText 
   * @returns Record<string, string>
   */
  private parseAuthResponse(responseText: string): Record<string, string> {
    const result: Record<string, string> = {};
    const regex = /^(\w+)=(.*)$/gm;
    let match;

    while ((match = regex.exec(responseText)) !== null) {
      result[match[1]] = match[2];
    }

    return result;
  }

}