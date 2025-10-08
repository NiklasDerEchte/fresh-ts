export type PlainObject = Record<string, any>;
export type MarkAction = 'read' | 'saved' | 'unsaved' | 'unread';
export type DateInput = string | number | Date | null;

export enum HttpMethod {
  POST = "post",
  GET = "get",
  DELETE = "delete",
  PUT = "put",
}

export interface RequestConfig {
  url: string;
  method?: HttpMethod;
  urlSearchParams?: {};
  body?: any;
  headers?: Record<string, string>;
}

export interface FreshRSSOptions {
  host: string;
  username?: string;
  password?: string;
  debug?: boolean;
}

export class APIError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'APIError';
  }
}

export class AuthenticationError extends APIError {
  constructor(message?: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export namespace Fever {
  export interface Item {
    id: number;
    feed_id: string | number;
    title?: string;
    author?: string;
    html?: string;
    url?: string;
    is_saved?: boolean;
    is_read?: boolean;
    created_on_time: string | number;
  }
}

export namespace Greader {
  export type GreaderAPIResponse = {
    max: number;
  }
  
  export interface UnreadCount {
    count: number;
    id: string;
    newestItemTimestampUsec: number;
  }
}
