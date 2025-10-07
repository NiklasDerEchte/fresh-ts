import { APIError, AuthenticationError, DateInput, FreshRSSOptions, HttpMethod, Item, MarkAction } from '../types';
import crypto from 'crypto';
import { HttpService } from './http';

export class FeverClient {

  private httpService: HttpService;

  /**
   * Creates an instance of FeverClient.
   * @param apiEndpoint 
   * @param apiKey 
   * @param debug 
   */
  constructor(
    private apiEndpoint: string,
    private apiKey: string,
    private debug = false
  ) {
    this.httpService = new HttpService(debug);
   }

  /**
   * Factory method to create and authenticate a FeverClient instance
   * @param options FreshRSSOptions
   * @returns Promise<FeverClient>
   */
  static async create(options: FreshRSSOptions): Promise<FeverClient> {
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
    let apiEndpoint = `${host}api/fever.php`;
    if (debug) console.log(`Using FreshRSS API endpoint: ${apiEndpoint}`);
    let apiKey = crypto.createHash('md5').update(`${username}:${password}`).digest('hex');
    const client = new FeverClient(apiEndpoint, apiKey, debug);
    await client.authenticate();
    return client;
  }


  /**
   * Initialize authentication check asynchronously
   * @throws AuthenticationError if authentication fails
   * @returns Promise<void>
   */
  private async authenticate(): Promise<void> {
    const response = await this.httpService.request<{api_version: number, auth: boolean, last_refreshed_on_time: number}>({
      url: this.apiEndpoint,
      method: HttpMethod.POST,
      body: { api_key: this.apiKey }
    });
    if(this.debug) console.log('Authentication response:', response);
    if (!response?.auth) {
      throw new AuthenticationError('Failed to authenticate with FreshRSS API');
    }
  }

  /**
   * Converts date string to microsecond timestamp
   * @param dateString The date string to convert (ISO format or YYYY-MM-DD)
   * @returns number The corresponding microsecond timestamp
   */
  private dateToMicroseconds(dateString: string): number {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-').map(Number);
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        throw new Error(`Invalid date string: ${dateString}`);
      }
      return Date.UTC(year, month - 1, day) * 1000;
    }
    const parsed = Date.parse(dateString);
    if (isNaN(parsed)) {
      throw new Error(`Invalid date string: ${dateString}`);
    }
    return parsed * 1000;
  }

  /**
   * Marks an item with the specified action (read, saved, etc.)
   * @param action The action to perform ('read', 'saved', 'unsaved')
   * @param id The ID of the item to mark
   * @returns Promise<any> The API response
   */
  public async setMark(action: MarkAction, id: string | number): Promise<any> {
    if (action === 'unread') {
      throw new Error("The Fever API does not support marking as 'unread'");
    }

    const response = await this.httpService.request<any>({
      url: this.apiEndpoint,
      method: HttpMethod.POST,
      body: { api_key: this.apiKey },
      urlSearchParams: { api: '', mark: 'item', as: action, id }
    });

    if (action === 'read') {
      if (!('read_item_ids' in response)) {
        console.error("The response to setMark does not contain 'read_item_ids'");
      }
    } else if (action === 'saved' || action === 'unsaved') {
      if (!('saved_item_ids' in response)) {
        console.error("The response to setMark does not contain 'saved_item_ids'");
      }
    }

    return response;
  }

  /**
   * Retrieves all feeds from FreshRSS
   * @returns Promise<any> The API response
   */
  public async getFeeds(): Promise<any> {
    return await this.httpService.request({
      url: this.apiEndpoint,
      method: HttpMethod.POST,
      body: { api_key: this.apiKey },
      urlSearchParams: { api: '', feeds: '' }
    });
  }

  /**
   * Retrieves all groups from FreshRSS
   * @returns Promise<any> The API response
   */
  public async getGroups(): Promise<any> {
    return await this.httpService.request({
      url: this.apiEndpoint,
      method: HttpMethod.POST,
      body: { api_key: this.apiKey },
      urlSearchParams: { api: '', groups: '' }
    });
  }

  /**
   * Retrieves all unread items
   * @return Promise<Item[]> The list of unread items
   */
  public async getUnreads(): Promise<Item[]> {
    const response = await this.httpService.request<any>({
      url: this.apiEndpoint,
      method: HttpMethod.POST,
      body: { api_key: this.apiKey },
      urlSearchParams: { api: '', unread_item_ids: ''}
    });
    const idsString = String(response?.unread_item_ids ?? '');
    const unreadIds = idsString.split(',').map((s) => s.trim()).filter(Boolean);

    if (unreadIds.length === 0) return [];

    const ids = unreadIds.map((s) => Number(s));
    return this.getItemsFromIds(ids);
  }

  /**
   * Retrieves all saved items
   * @return Promise<Item[]> The list of saved items
   */
  public async getSaved(): Promise<Item[]> {
    const response = await this.httpService.request<any>({
      url: this.apiEndpoint,
      method: HttpMethod.POST,
      body: { api_key: this.apiKey },
      urlSearchParams: { api: '', saved_item_ids: '' }
    });
    if(this.debug) console.log('Saved items response:', response);
    const idsString = String(response?.saved_item_ids ?? '');
    const savedIds = idsString.split(',').map((s) => s.trim()).filter(Boolean);

    if (savedIds.length === 0) return [];

    const ids = savedIds.map((s) => Number(s));
    return this.getItemsFromIds(ids);
  }

  /**
   * Retrieves items by their IDs
   * @param ids The list of item IDs to retrieve
   * @returns Promise<Item[]> The list of retrieved items
   */
  public async getItemsFromIds(ids: number[]): Promise<Item[]> {
    if (!ids || ids.length === 0) return [];

    const allItems: Item[] = [];
    const totalRequested = ids.length;

    // Process in batches of 50 items
    for (let i = 0; i < totalRequested; i += 50) {
      const batch = ids.slice(i, i + 50);
      const response = await this.httpService.request<any>({
        url: this.apiEndpoint,
        method: HttpMethod.POST,
        body: { api_key: this.apiKey },
        urlSearchParams: {api: '', items: '', with_ids: batch.join(',')}
      });
      const items = (response?.items ?? []) as Item[];
      allItems.push(...items);
    }

    if (allItems.length !== totalRequested) {
      throw new APIError(
        `API returned ${allItems.length} items but ${totalRequested} were requested. ` +
        'Some items may not exist or may not be accessible.'
      );
    }

    allItems.sort((a, b) => a.id - b.id);
    return allItems;
  }

  /**
   * Retrieves items within a date range
   * @param since The start date (inclusive)
   * @param until The end date (exclusive). If null, defaults to now.
   * @returns Promise<Item[]> The list of items within the date range
   */
  public async getItemsFromDates(
    since: DateInput,
    until: DateInput = null
  ): Promise<Item[]> {
    if (since === null) {
      throw new Error("The 'since' parameter is required");
    }

    let sinceId: number;
    if (typeof since === 'string') {
      sinceId = this.dateToMicroseconds(since);
    } else if (since instanceof Date) {
      sinceId = since.getTime() * 1000;
    } else {
      sinceId = Number(since);
    }

    let untilId: number;
    if (until === null) {
      untilId = Date.now() * 1000; // Now in microseconds
    } else if (typeof until === 'string') {
      untilId = this.dateToMicroseconds(until);
    } else if (until instanceof Date) {
      untilId = until.getTime() * 1000;
    } else {
      untilId = Number(until);
    }

    if (!(sinceId < untilId)) {
      throw new Error("The 'since' date must be earlier than the 'until' date");
    }

    const allItems: Item[] = [];
    const seenIds = new Set<number>();
    let currentSinceId = sinceId;

    while (true) {
      const response = await this.httpService.request<any>({
        url: this.apiEndpoint,
        method: HttpMethod.POST,
        body: { api_key: this.apiKey }, 
        urlSearchParams: { api: '', items: { since_id: String(currentSinceId) }}
      });
      if(this.debug) console.log('Items response:', response);
      const itemsBatch = (response?.items ?? []) as Item[];

      if (!itemsBatch || itemsBatch.length === 0) break;

      const newItems: Item[] = [];
      let highestId = currentSinceId;

      for (const item of itemsBatch) {
        const itemId = Number(item.id);

        if (seenIds.has(itemId)) continue;
        if (itemId > untilId) continue;

        newItems.push(item);
        seenIds.add(itemId);

        if (itemId > highestId) {
          highestId = itemId;
        }
      }

      allItems.push(...newItems);

      if (itemsBatch.length < 50) break;

      currentSinceId = highestId;

      if (allItems.length !== seenIds.size) {
        throw new Error(
          `Duplicate item IDs detected in results! This should never happen. ` +
          `Items count: ${allItems.length}, Unique IDs count: ${seenIds.size}`
        );
      }
    }

    allItems.sort((a: Item, b: Item) => a.id - b.id);
    return allItems;
  }
}