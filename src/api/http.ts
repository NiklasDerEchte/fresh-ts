import { RequestConfig } from "../types";

/**
 * Executes the HTTP request using axios or fetch as fallback
 */
export async function request<T = any>(config: RequestConfig): Promise<T> {
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

  const response = await fetchImpl(url.toString(), {
    method: config.method || 'GET',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const isText = contentType.includes('text/plain');
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`);
  }
  let result;
  if (isJson) {
    result = await response.json().catch(async (error: any) => {
      throw new Error(`Failed to parse JSON response: ${error.message}`);
    });
  } else if (isText) {
    result = await response.text().catch(async (error: any) => {
      throw new Error(`Failed to get text response: ${error.message}`);
    });
  }
  return result as T;
}