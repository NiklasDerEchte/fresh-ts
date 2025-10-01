declare const require: any;

export class Item {
  public readonly id: number;
  public readonly feed_id: number;
  public readonly title: string;
  public readonly author: string;
  public readonly html: string;
  public readonly url: string;
  public readonly is_saved: boolean;
  public readonly is_read: boolean;
  public readonly created_on_time: number; // seconds since epoch

  constructor(props: {
    id: number;
    feed_id: number;
    title: string;
    author: string;
    html: string;
    url: string;
    is_saved: boolean;
    is_read: boolean;
    created_on_time: number;
  }) {
    this.id = props.id;
    this.feed_id = props.feed_id;
    this.title = props.title;
    this.author = props.author;
    this.html = props.html;
    this.url = props.url;
    this.is_saved = props.is_saved;
    this.is_read = props.is_read;
    this.created_on_time = props.created_on_time;

    Object.freeze(this);
  }

  // Versucht zuerst, ein externes HTML->Markdown/Plain-Text Paket zu nutzen.
  // Falls keines vorhanden ist, wird ein einfacher DOM-/Regex-Fallback verwendet.
  public get readable(): string {
    // Try turndown (HTML -> Markdown) if available
    try {
      const TurndownService = require('turndown');
      if (TurndownService) {
        const td = new TurndownService();
        return td.turndown(this.html).trim();
      }
    } catch {
      /* ignore */
    }

    // Try html-to-text if available
    try {
      const { htmlToText } = require('html-to-text');
      if (htmlToText) {
        return htmlToText(this.html, { wordwrap: false }).trim();
      }
    } catch {
      /* ignore */
    }

    // Fallback: use DOMParser in browser-like env
    try {
      if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
        const parser = new window.DOMParser();
        const doc = parser.parseFromString(this.html, 'text/html');
        // remove script/style
        Array.from(doc.querySelectorAll('script, style')).forEach((el) => el.remove());
        return normalizeText(doc.body.textContent || '');
      }
    } catch {
      /* ignore */
    }

    // Node or other fallback: remove scripts/styles and tags, preserve paragraph breaks
    let s = this.html.replace(/<script[\s\S]*?<\/script>/gi, '');
    s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
    // replace block-level tags with newlines to preserve paragraph-like separation
    s = s.replace(/<(?:\/p|br|\/div|\/h[1-6]|\/li|\/blockquote|\/pre|\/tr|\/table|\/ul|\/ol)[^>]*>/gi, '\n');
    // remove remaining tags
    s = s.replace(/<[^>]+>/g, '');
    return normalizeText(s);
  }

  // created_on_time is seconds since epoch (like Python's fromtimestamp)
  public get created_datetime(): Date {
    return new Date(this.created_on_time * 1000);
  }

  // id treated as timestamp seconds like in original Python example
  public get id_datetime(): Date {
    return new Date(this.id * 1000);
  }
}

// Helper: collapse whitespace but preserve newlines, trim edges
function normalizeText(input: string): string {
  // replace multiple whitespace chars (except newline) with single space
  const parts = input
    .split(/\n+/)
    .map((line) => line.replace(/[ \t\r\f\v]+/g, ' ').trim())
    .filter(Boolean);
  return parts.join('\n').trim();
}