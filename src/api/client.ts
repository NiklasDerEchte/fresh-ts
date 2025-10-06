import { APIError, APIResponse, DateInput, FreshRSSOptions, Item, MarkAction } from '../types';
import { GreaderAPICore } from './greader-core';
import { FeverAPICore } from './fever-core';

export class FreshFetchClient {
  private core: FeverAPICore | GreaderAPICore;
  constructor(options: FreshRSSOptions) {
    if(!options.endpoint || options.endpoint == 'fever') {
      this.core = new FeverAPICore(options);
    } else {
      this.core = new GreaderAPICore(options);;
    }
  }

  /**
   * Converts date string to microsecond timestamp ID
   */
  private dateToId(dateString: string, dateFormat: string = '%Y-%m-%d'): number {
    if (dateFormat === '%Y-%m-%d') {
      const parts = dateString.split('-').map((part) => Number(part));
      if (parts.length < 3 || parts.some(Number.isNaN)) {
        throw new Error('Invalid date string for format %Y-%m-%d');
      }
      const [year, month, day] = parts;
      // Date.UTC returns milliseconds; multiply by 1000 to get microseconds
      return Date.UTC(year, month - 1, day) * 1000;
    }

    // Fallback: try Date.parse
    const parsed = Date.parse(dateString);
    if (isNaN(parsed)) {
      throw new Error('Unable to parse date string');
    }
    return parsed * 1000;
  }

  /**
   * Marks an item with the specified action (read, saved, etc.)
   */
  public async setMark(action: MarkAction, id: string | number): Promise<APIResponse> {
    if (action === 'unread') {
      throw new Error("The Fever API does not support marking as 'unread'");
    }

    const response = await this.core.request('api', { mark: 'item', as_: action, id });

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
   */
  public async getFeeds(): Promise<APIResponse> {
    return this.core.request('feeds');
  }

  /**
   * Retrieves all groups from FreshRSS
   */
  public async getGroups(): Promise<APIResponse> {
    return this.core.request('groups');
  }

  /**
   * Retrieves all unread items
   */
  public async getUnreads(): Promise<Item[]> {
    const response = await this.core.request('unread_item_ids');
    const idsString = String(response?.unread_item_ids ?? '');
    const unreadIds = idsString.split(',').map((s) => s.trim()).filter(Boolean);

    if (unreadIds.length === 0) return [];

    const ids = unreadIds.map((s) => Number(s));
    return this.getItemsFromIds(ids);
  }

  /**
   * Retrieves all saved items
   */
  public async getSaved(): Promise<Item[]> {
    const response = await this.core.request('saved_item_ids');
    const idsString = String(response?.saved_item_ids ?? '');
    const savedIds = idsString.split(',').map((s) => s.trim()).filter(Boolean);

    if (savedIds.length === 0) return [];

    const ids = savedIds.map((s) => Number(s));
    return this.getItemsFromIds(ids);
  }

  /**
   * Retrieves items by their IDs
   */
  public async getItemsFromIds(ids: number[]): Promise<Item[]> {
    if (!ids || ids.length === 0) return [];

    const allItems: Item[] = [];
    const totalRequested = ids.length;

    // Process in batches of 50 items
    for (let i = 0; i < totalRequested; i += 50) {
      const batch = ids.slice(i, i + 50);
      const batchParams = { with_ids: batch.join(',') };
      const response = await this.core.request('items', batchParams);
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
   */
  public async getItemsFromDates(
    since: DateInput,
    until: DateInput = null,
    dateFormat: string = '%Y-%m-%d'
  ): Promise<Item[]> {
    if (since === null) {
      throw new Error("The 'since' parameter is required");
    }

    let sinceId: number;
    if (typeof since === 'string') {
      sinceId = this.dateToId(since, dateFormat);
    } else if (since instanceof Date) {
      sinceId = since.getTime() * 1000;
    } else {
      sinceId = Number(since);
    }

    let untilId: number;
    if (until === null) {
      untilId = Date.now() * 1000; // Now in microseconds
    } else if (typeof until === 'string') {
      untilId = this.dateToId(until, dateFormat);
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
      const response = await this.core.request('items', { since_id: String(currentSinceId) });
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