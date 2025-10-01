import { Item } from './utils/items';
import { APIError, AuthenticationError } from './utils/errors';
import crypto from 'crypto';

type PlainObject = Record<string, any>;

export class FreshRSSAPI {
  public static VERSION = '2.0.3';

  private host: string;
  private api_endpoint: string;
  private verify_ssl: boolean;
  private verbose: boolean;
  private api_key: string;

  constructor(options: {
    host?: string;
    username?: string;
    password?: string;
    verify_ssl?: boolean;
    verbose?: boolean;
  } = {}) {
    const host = options.host || process.env.FRESHRSS_API_HOST;
    const username = options.username || process.env.FRESHRSS_API_USERNAME;
    const password = options.password || process.env.FRESHRSS_API_PASSWORD;
    let verify_ssl = options.verify_ssl ?? true;
    const verbose = options.verbose ?? false;

    const env_verify = process.env.FRESHRSS_API_VERIFY_SSL;
    if (typeof env_verify !== 'undefined') {
      verify_ssl = ['true', '1', 'yes'].includes(env_verify.toLowerCase());
    }

    if (!host) {
      throw new Error('Host URL is required. Provide it as an argument or set FRESHRSS_API_HOST environment variable.');
    }
    if (!username) {
      throw new Error('Username is required. Provide it as an argument or set FRESHRSS_API_USERNAME environment variable.');
    }
    if (!password) {
      throw new Error('Password is required. Provide it as an argument or set FRESHRSS_API_PASSWORD environment variable.');
    }

    this.host = host.replace(/\/+$/, '');
    // build API endpoint similar to urljoin(f"{host}/api/", "fever.php")
    this.api_endpoint = new URL('/api/fever.php', `${this.host}/`).toString();
    this.verify_ssl = verify_ssl;
    this.verbose = verbose;

    // md5 of "username:password"
    this.api_key = crypto.createHash('md5').update(`${username}:${password}`).digest('hex');

    // synchronous check on init can be async, but keep same behavior: call and ignore returned promise by awaiting now
    // caller should be aware this may throw (we keep it synchronous by awaiting)
    // NOTE: calling async function from constructor: use IIFE
    (async () => {
      await this._check_auth();
    })().catch((err) => { throw err; });
  }

  private async _check_auth(): Promise<void> {
    const response = await this._call('api');
    if (!response?.auth) {
      throw new AuthenticationError('Failed to authenticate with FreshRSS API');
    }
  }

  private async _call(endpoint: string = 'api', params: PlainObject = {}): Promise<PlainObject> {
    const data = { api_key: this.api_key };

    // build query params: start with { api: '' } and if endpoint != 'api' add endpoint: ''
    const queryParams: PlainObject = { api: '' };
    if (endpoint !== 'api') {
      queryParams[endpoint] = '';
    }
    Object.assign(queryParams, params);

    // handle 'as_' -> 'as'
    if ('as_' in queryParams) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      queryParams['as'] = queryParams['as_'];
      delete queryParams['as_'];
    }

    if (this.verbose) {
      // lightweight logging
      // console used instead of logger to avoid extra deps
      console.info('API request:', this.api_endpoint);
      console.info('Query parameters:', queryParams);
    }

    const maxRetries = 1;
    const retryDelay = 2000;
    let attempt = 0;

    while (true) {
      try {
        // prefer axios if available (for https agent control), fallback to global fetch
        try {
          const axios = require('axios');
          const https = require('https');
          const httpsAgent = this.verify_ssl ? undefined : new https.Agent({ rejectUnauthorized: false });

          const resp = await axios.post(this.api_endpoint, new URLSearchParams(data), {
            params: queryParams,
            httpsAgent,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000,
          });
          const result = resp.data;
          if (!result?.auth) {
            throw new AuthenticationError('Invalid API credentials');
          }
          if (this.verbose) console.info('API response:', result);
          return result;
        } catch (eAxios) {
          // fallback to fetch
          // build URL with query params
          const url = new URL(this.api_endpoint);
          Object.keys(queryParams).forEach((k) => {
            // for keys with empty string value we still want key present: set to ''
            url.searchParams.set(k, String(queryParams[k]));
          });

          // body as form data
          const body = new URLSearchParams(data).toString();

          // In environments where verify_ssl cannot be configured via fetch easily, we ignore that flag
          const fetchImpl = (globalThis as any).fetch;
          const resp = await fetchImpl(url.toString(), {
            method: 'POST',
            body,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          });
          if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${text}`);
          }
          const result = await resp.json().catch((err: any) => { throw err; });
          if (!result?.auth) {
            throw new AuthenticationError('Invalid API credentials');
          }
          if (this.verbose) console.info('API response:', result);
          return result;
        }
      } catch (e: any) {
        attempt += 1;
        const isRequestError = !(e instanceof SyntaxError);
        const errorType = isRequestError ? 'API request' : 'JSON parsing';
        if (attempt <= maxRetries) {
          if (this.verbose) console.warn(`${errorType} failed, retrying in ${retryDelay / 1000}s: ${String(e)}`);
          await new Promise((r) => setTimeout(r, retryDelay));
          continue;
        }
        if (isRequestError) {
          throw new APIError(`API request failed after retry: ${String(e)}`);
        } else {
          throw new APIError(`Failed to parse API response after retry: ${String(e)}`);
        }
      }
    }
  }

  private _dict_to_item(itemDict: PlainObject): Item {
    return new Item({
      id: Number(itemDict.id),
      feed_id: Number(itemDict.feed_id),
      title: String(itemDict.title ?? ''),
      author: String(itemDict.author ?? ''),
      html: String(itemDict.html ?? ''),
      url: String(itemDict.url ?? ''),
      is_saved: Boolean(itemDict.is_saved),
      is_read: Boolean(itemDict.is_read),
      created_on_time: Number(itemDict.created_on_time),
    });
  }

  // date_str expected like 'YYYY-MM-DD' by default, returns microsecond timestamp (int)
  public static _date_to_id(date_str: string, date_format: string = '%Y-%m-%d'): number {
    if (date_format === '%Y-%m-%d') {
      const parts = date_str.split('-').map((p) => Number(p));
      if (parts.length < 3 || parts.some(Number.isNaN)) {
        throw new Error('Invalid date string for format %Y-%m-%d');
      }
      const [year, month, day] = parts;
      // Date.UTC returns milliseconds; multiply by 1000 to get microseconds
      return Date.UTC(year, month - 1, day) * 1000;
    }
    // fallback: try Date.parse
    const parsed = Date.parse(date_str);
    if (isNaN(parsed)) throw new Error('Unable to parse date string');
    return parsed * 1000;
  }

  public async set_mark(as_: 'read' | 'saved' | 'unsaved' | 'unread', id: string | number): Promise<PlainObject> {
    if (as_ === 'unread') throw new Error("The Fever_API does not support marking as 'unread'");
    const resp = await this._call('api', { mark: 'item', as_: as_, id });
    if (as_ === 'read') {
      if (!('read_item_ids' in resp)) {
        console.error("The response to set_mark does not contain 'read_item_ids'");
      }
    } else if (as_ === 'saved' || as_ === 'unsaved') {
      if (!('saved_item_ids' in resp)) {
        console.error("The response to set_mark does not contain 'saved_item_ids'");
      }
    }
    return resp;
  }

  public async get_feeds(): Promise<PlainObject> {
    return this._call('feeds');
  }

  public async get_groups(): Promise<PlainObject> {
    return this._call('groups');
  }

  public async get_unreads(): Promise<Item[]> {
    const resp = await this._call('unread_item_ids');
    const idsStr = String(resp?.unread_item_ids ?? '');
    const unreadIds = idsStr.split(',').map((s) => s.trim()).filter(Boolean);
    if (unreadIds.length === 0) return [];
    const ids = unreadIds.map((s) => Number(s));
    return this.get_items_from_ids(ids);
  }

  public async get_saved(): Promise<Item[]> {
    const resp = await this._call('saved_item_ids');
    const idsStr = String(resp?.saved_item_ids ?? '');
    const savedIds = idsStr.split(',').map((s) => s.trim()).filter(Boolean);
    if (savedIds.length === 0) return [];
    const ids = savedIds.map((s) => Number(s));
    return this.get_items_from_ids(ids);
  }

  public async get_items_from_ids(ids: number[]): Promise<Item[]> {
    if (!ids || ids.length === 0) return [];
    const allItems: Item[] = [];
    const totalRequested = ids.length;

    for (let i = 0; i < totalRequested; i += 50) {
      const batch = ids.slice(i, i + 50);
      const batchParams = { with_ids: batch.join(',') };
      const response = await this._call('items', batchParams);
      const items = (response?.items ?? []).map((it: any) => this._dict_to_item(it));
      allItems.push(...items);
    }

    if (allItems.length !== totalRequested) {
      throw new APIError(`API returned ${allItems.length} items but ${totalRequested} were requested. Some items may not exist or may not be accessible.`);
    }

    allItems.sort((a, b) => a.id - b.id);
    return allItems;
  }

  public async get_items_from_dates(
    since: string | number | Date | null,
    until: string | number | Date | null = null,
    date_format: string = '%Y-%m-%d'
  ): Promise<Item[]> {
    if (since === null) throw new Error("The 'since' parameter is required");

    let since_id: number;
    if (typeof since === 'string') {
      since_id = FreshRSSAPI._date_to_id(since, date_format);
    } else if (since instanceof Date) {
      since_id = since.getTime() * 1000;
    } else {
      since_id = Number(since);
    }

    let until_id: number;
    if (until === null) {
      until_id = Date.now() * 1000; // now in microseconds
    } else if (typeof until === 'string') {
      until_id = FreshRSSAPI._date_to_id(until, date_format);
    } else if (until instanceof Date) {
      until_id = until.getTime() * 1000;
    } else {
      until_id = Number(until);
    }

    if (!(since_id < until_id)) {
      throw new Error("The 'since' date must be earlier than the 'until' date");
    }

    const allItems: Item[] = [];
    const seenIds = new Set<number>();
    let current_since_id = since_id;

    while (true) {
      const response = await this._call('items', { since_id: String(current_since_id) });
      const items_batch = (response?.items ?? []) as PlainObject[];

      if (!items_batch || items_batch.length === 0) break;

      const newItems: Item[] = [];
      let highest_id = current_since_id;

      for (const itemDict of items_batch) {
        const item_id = Number(itemDict.id);
        if (seenIds.has(item_id)) continue;
        if (item_id > until_id) continue;
        newItems.push(this._dict_to_item(itemDict));
        seenIds.add(item_id);
        if (item_id > highest_id) highest_id = item_id;
      }

      allItems.push(...newItems);

      if (items_batch.length < 50) break;

      current_since_id = highest_id;

      if (allItems.length !== seenIds.size) {
        throw new Error(`Duplicate item IDs detected in results! This should never happen. Items count: ${allItems.length}, Unique IDs count: ${seenIds.size}`);
      }
    }

    allItems.sort((a, b) => a.id - b.id);
    return allItems;
  }
}