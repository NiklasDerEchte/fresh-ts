import { Greader, AuthenticationError, FreshRSSOptions, HttpMethod } from "../types";
import { HttpService } from './http';

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

  public async getUnreadCount() { // TODO: Docu
    let response = await this.httpService.request<Greader.GreaderAPIResponse<'unreadcounts', Greader.UnreadCount[]>>({
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

  public async getItems(
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

  // Maybe this route doesnt exist
  public async getPreferences() { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, '/reader/api/0/preference/list'),
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

  public async getStarredItems( // TODO: Docu and define return type
    n: number = 20 // Get the number of starred articles, the maximum is 1000.
  ) {
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, '/reader/api/0/stream/contents/user/-/state/com.google/starred'),
      method: HttpMethod.GET,
      urlSearchParams: {
        n: n,
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

  public async getFeedItems( // TODO: Docu and define return type
    feedUrl: string,
    n: number = 20, // Number of loaded article entries
    xt: string | undefined = undefined // Excluded labels
  ) {
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/atom/feed/${feedUrl}`),
      method: HttpMethod.GET,
      urlSearchParams: {
        n: n,
        xt: xt,
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

  // Maybe this route doesnt exist
  public async getUserSharedItems( // TODO: Docu and define return type
    count: number = 20 // To get the number of articles shared by users
  ) {
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/reader/atom/user/-/state/com.google/broadcast`),
      method: HttpMethod.GET,
      urlSearchParams: {
        n: count,
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

  public async getTags() { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/tag/list`),
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

  public async addSubscription(
    ac: string, // operation type, fixed value is subscribe.
    s: string, // {feed_url}: the link to the RSS feed to be added, prefixed with feed/
    a: string, // {folder}: the RSS group you want to add to, prefixed with user/-/label/
    t: string // {feed_title}:The name of the subscription source you want to chang
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/subscription/edit`),
      method: HttpMethod.POST,
      body: {
        ac: ac,
        s: s,
        a: a,
        t: t
      },
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

  public async quickAddSubscription(
    quickadd: string // the link to the RSS feed to be added
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/subscription/quickadd`),
      method: HttpMethod.POST,
      body: {
        quickadd: `feed/${quickadd}`
      },
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

  public async editTag(
    ac: string, // operation type, fixed value is edit
    a: string, // the name of the folder, prefixed with user/-/label/
    s: string // the link to the RSS feed to be added to the folder, prefixed with feed/, where a feed link must be provided
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/edit-tag`),
      method: HttpMethod.POST,
      body: {
        ac: ac,
        a: a,
        s: s
      },
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

  public async editSpecificSharedTag(
    a: string, // operation type, fixed value is user/-/state/com.google/broadcast
    i: string, // The entry_id of the corresponding article, which can be found in the <id> element of the <atom> tag
    s: string // The stream_id of the corresponding article can be found in the gr:stream-id attribute of the <source> element of the <atom> tag
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/edit-tag`),
      method: HttpMethod.POST,
      body: {
        a: a,
        i: i,
        s: s,
        async: true
      },
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

  public async editSpecificTag(
    a: string, // {tag} is the name of the label, prefixed with user/-/label/.
    i: string, // The entry_id of the corresponding article, which can be found in the <id> element of the <atom> tag
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/edit-tag`),
      method: HttpMethod.POST,
      body: {
        a: a,
        i: i,
        async: true
      },
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

  public async addMultipleTags(
    a: string, // {tag1} {tag2} ... For tag names, use user/-/label/ prefix, add multiple tags by repeating the a parameter
    i: string, // The entry_id of the corresponding article, which can be found in the <id> element of the <atom> tag
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/edit-tag`),
      method: HttpMethod.POST,
      body: {
        a: a,
        i: i,
        async: true
      },
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

  public async moveSubscription(
    ac: string, // Operation type
    s: string, // {feed_url}:  Links to RSS feeds to be moved
    r: string, // {old_folder}: The name of the folder where the subscription feed is currently located, using the user/-/label/ prefix
    a: string // {new_folder}: Subscription source target folder name, using the user/-/label/ prefix
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/subscription/edit`),
      method: HttpMethod.POST,
      body: {
        ac: ac,
        s: s,
        r: r,
        a: a
      },
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

  public async renameSubscription(
    ac: string, // Operation type
    s: string, // {feed_url}: Links to RSS feeds to be renamed
    t: string, // {new_feed_title}: New subscription feed name
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/subscription/edit`),
      method: HttpMethod.POST,
      body: {
        ac: ac,
        s: s,
        t: t
      },
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

  public async editSubscriptionTag(
    ac: string, // Operation type
    a: string, // user label/folder path, {folder} for label/folder name, use user/-/label/ prefix
    s: string, // {feed_url}: the link to the RSS feed to be added to the tag, prefixed with feed/.A feed must be provided or the folder cannot be created
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/edit-tag`),
      method: HttpMethod.POST,
      body: {
        ac: ac,
        a: a,
        s: s
      },
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

  public async deleteTag(
    ac: string, // Operation type
    s: string, // user label/folder path, {folder} is the folder name, use user/-/label/ prefix
    t: string, // Name of the folder to be deleted
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/disable-tag`),
      method: HttpMethod.POST,
      body: {
        ac: ac,
        s: s,
        t: t
      },
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

  public async removeTagFromItems(
    s: string, //  	{tag_name}: The name of the label to be deleted must be prefixed with user/-/label/.
    t: string, // {tag_name}: the name of the tag to be deleted
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/disable-tag`),
      method: HttpMethod.POST,
      body: {
        s: s,
        t: t
      },
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

  public async cancellationSpecifiedTag(
    r: string, // Cancelling a shared operation
    i: string, // The {entry_id} corresponding to the article can be found in the <entry> tag
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/edit-tag`),
      method: HttpMethod.POST,
      body: {
        r: r,
        i: i,
        async: true
      },
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

  public async editTagSettings(
    s: string, // {tag}: Corresponding tags
    t: string, // {tag}: Corresponding tags
    pub: boolean // Publicly released or not, true for public, false for private 
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/edit-tag`),
      method: HttpMethod.POST,
      body: {
        s: s,
        t: t,
        pub: pub
      },
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

  public async deleteSubscription(
    ac: string, // Action type, in this case unsubscribe
    s: string, // {feed_id}:The id of the RSS feed you want to delete must start with feed/, example: feed/52
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/subscription/edit`),
      method: HttpMethod.POST,
      body: {
        ac: ac,
        s: s,
      },
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

  public async deleteMultipleSubscriptions(
    ac: string, // Action type, in this case unsubscribe
    s: string, // {feed_id}:The id of the RSS feed you want to delete must start with feed/, example: feed/52
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/subscription/edit`),
      method: HttpMethod.POST,
      body: {
        ac: ac,
        s: s,
      },
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

  public async markFeedAsRead(
    s: string, // feed URL
    ts: string, // feed URL
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/mark-all-as-read`),
      method: HttpMethod.POST,
      body: {
        s: `feed/${s}`,
        ts: ts,
      },
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

  public async markFeedInFolderAsRead(
    s: string, // folder name
    ts: string, // timestamp to mark read time
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/mark-all-as-read`),
      method: HttpMethod.POST,
      body: {
        s: s,
        ts: ts,
      },
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

  public async markItemAsRead(
    ac: string, // Operation type
    i: string, // entry ID
    a: string, // mark as read status
    s: string, // Links to RSS feeds (optional, Google Reader includes this parameter, but it doesn't seem to be necessary)
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/edit-tag`),
      method: HttpMethod.POST,
      body: {
        ac: ac,
        i: i,
        s: s,
        a: a,
        async: true
      },
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

  public async markItemAsUnread(
    ac: string, // type
    i: string, // entry ID
    r: string, // remove read status
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/edit-tag`),
      method: HttpMethod.POST,
      body: {
        ac: ac,
        i: i,
        r: r,
        async: true
      },
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

  public async markMultipleItemsAsRead(
    ac: string, // Operation type
    i: string, // Multiple Entry IDs, concatenate them with &i=.
    a: string, // mark as read status
    s: string, // Links to RSS feeds (optional, Google Reader includes this parameter, but it doesn't seem to be necessary)
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/edit-tag`),
      method: HttpMethod.POST,
      body: {
        ac: ac,
        i: i,
        s: s,
        a: a,
        async: true
      },
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

  public async searchCategories(
    q: string, // Search keyword
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/directory/search`),
      method: HttpMethod.GET,
      urlSearchParams: {
        q: q,
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

  public async searchItemIds(
    q: string, // Search keyword
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/search/items/ids`),
      method: HttpMethod.GET,
      urlSearchParams: {
        q: q,
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

  public async searchItemContents(
    i: string, // Multiple item IDs, use &i= to concatenate
  ) { // TODO: Docu and define return type
    let response = await this.httpService.request<any>({
      url: this.httpService.urlForge(this.apiEndpoint, `/reader/api/0/stream/items/contents`),
      method: HttpMethod.POST,
      body: {
        i: i,
      },
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