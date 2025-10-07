import { AuthenticationError, FreshRSSOptions, HttpMethod } from "../types";
import { HttpService } from './http';

// curl 'https://freshrss.example.net/api/greader.php/accounts/ClientLogin?Email=alice&Passwd=Abcdef123456'
// SID=alice/8e6845e089457af25303abc6f53356eb60bdb5f8
// Auth=alice/8e6845e089457af25303abc6f53356eb60bdb5f8

// curl -s -H "Authorization:GoogleLogin auth=alice/8e6845e089457af25303abc6f53356eb60bdb5f8" \
//   'https://freshrss.example.net/api/greader.php/reader/api/0/tag/list?output=json'

export class GreaderClient {

  private httpService: HttpService;
  private client = "fresh-ts:GreaderClient";
  private sessionToken: string | undefined;
  private userAuth: string | undefined;
  private sid: string | undefined;

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
   * Change the client name used in API requests
   * @param name 
   */
  public changeClientName(name: string) {
    this.client = name;
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
    if (!sid) {
      throw new AuthenticationError('Failed to authenticate with FreshRSS API: Missing SID');
    }
    this.userAuth = auth;
    this.sid = sid;
    let token = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, '/reader/api/0/token'),
      method: HttpMethod.GET,
      headers: {
        Authorization: `GoogleLogin auth=${this.userAuth}`
      }
    });
    if (!token) {
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

  public async getSubscriptions() { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, '/reader/api/0/subscription/list'),
      method: HttpMethod.GET,
      urlSearchParams: {
        T: this.sessionToken,
        client: this.client,
        output: "json"
      },
      headers: {
        Authorization: `GoogleLogin auth=${this.userAuth}`,
        Cookie: `SID=${this.sid}`
      }
    });
    if (this.debug) console.log(response);
    return response;
  }

  public async getUnreadCount() { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, '/reader/api/0/unread-count'),
      method: HttpMethod.GET,
      urlSearchParams: {
        T: this.sessionToken,
        client: this.client,
        output: "json"
      },
      headers: {
        Authorization: `GoogleLogin auth=${this.userAuth}`,
        Cookie: `SID=${this.sid}`
      }
    });
    if (this.debug) console.log(response);
    return response;
  }

  public async getEntries(
    n: number = 20, // Maximum number of requests, up to 1000
    r: 'o' | 'n' = 'o', // Sort by. o means sort by posting time (old->new), n means sort by updating time (new->old).
    t: number | undefined = undefined, // Get articles that are more recent than the specified timestamp (Unix timestamp, milliseconds)
    ot: number | undefined = undefined, // Get articles older than the specified timestamp (Unix timestamp, milliseconds)
    xt: string | undefined = undefined, // Exclude tab, example for excluding read content
    c: string | undefined = undefined // Continued reading string for paging to load more entries
  ) { // TODO: Docu and define return type, change parameter names and timestamps to Date()
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, '/reader/api/0/stream/contents/user/-/state/com.google/reading-list'),
      method: HttpMethod.GET,
      urlSearchParams: {
        n: n,
        r: r,
        t: t,
        ot: ot,
        xt: xt,
        c: c,
        T: this.sessionToken,
        client: this.client,
        output: "json"
      },
      headers: {
        Authorization: `GoogleLogin auth=${this.userAuth}`,
        Cookie: `SID=${this.sid}`
      }
    });
    if (this.debug) console.log(response);
    return response;
  }

  public async getUserInfos() { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, '/reader/api/0/user-info'),
      method: HttpMethod.GET,
      urlSearchParams: {
        T: this.sessionToken,
        client: this.client,
        output: "json"
      },
      headers: {
        Authorization: `GoogleLogin auth=${this.userAuth}`,
        Cookie: `SID=${this.sid}`
      }
    });
    if (this.debug) console.log(response);
    return response;
  }

  public async getFriends() { // TODO: Docu and define return type | BUG 400 Bad Request i dont know why
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, '/reader/api/0/friend/list'),
      method: HttpMethod.GET,
      urlSearchParams: {
        T: this.sessionToken,
        client: this.client,
        output: "json"
      },
      headers: {
        Authorization: `GoogleLogin auth=${this.userAuth}`,
        Cookie: `SID=${this.sid}`
      }
    });
    if (this.debug) console.log(response);
    return response;
  }
}