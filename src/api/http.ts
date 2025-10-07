import { RequestConfig } from "../types";

export class HttpService {

  constructor(
    private debug: boolean = false
  ) { }

  /**
   * Combines a base URL and a path into a single URL
   * @param base The base URL
   * @param path The path to append
   * @returns The combined URL
   */
  public urlForge(base: string, path: string): string {
    if (base.endsWith("/")) {
      base = base.slice(0, -1);
    }
    if (path.startsWith("/")) {
      path = path.slice(1);
    }
    let url = `${base}/${path}`;
    if (this.debug) console.log(`Forged URL: ${url}`);
    return url;
  }

  /**
   * Executes the HTTP request using axios or fetch as fallback
   * @param config RequestConfig
   * @returns Promise<T> The response data
   */
  public async request<T = any>(config: RequestConfig): Promise<T> {
    const url = new URL(config.url);

    if (config.urlSearchParams) {
      Object.keys(config.urlSearchParams).forEach((key) => {
        url.searchParams.set(key, String((config.urlSearchParams as any)[key]));
      });
    }

    let body: string | undefined;
    if (config.body) {
      if (typeof config.body === 'object') {
        body = new URLSearchParams(config.body).toString();
      } else {
        body = String(config.body);
      }
    }

    const fetchImpl = globalThis.fetch;
    if (!fetchImpl) {
      throw new Error('fetch() is not available. Please use Node.js 18+ or add a fetch polyfill.');
    }

    const defaultHeaders: Record<string, string> = {};
    if (!config.headers || !Object.keys(config.headers).find(key => key.toLowerCase() === 'content-type')) {
      defaultHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    const response = await fetchImpl(url.toString(), {
      method: config.method || 'GET',
      body,
      headers: {
        ...defaultHeaders,
        ...config.headers
      }
    });
    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const isBlob = contentType.includes('application/octet-stream');
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`);
    }
    let result;
    if (isJson) {
      result = await response.json().catch(async (error: any) => {
        throw new Error(`Failed to parse JSON response: ${error.message}`);
      });
    } else if (isBlob) {
      result = await response.blob().catch(async (error: any) => {
        throw new Error(`Failed to get blob response: ${error.message}`);
      });
    } else {
      result = await response.text().catch(async (error: any) => {
        throw new Error(`Failed to get text response: ${error.message}`);
      });
    }
    return result as T;
  }
}