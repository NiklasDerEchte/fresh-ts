# Fresh-ts

A TypeScript client for the FreshRSS API supporting both Fever API and Google Reader API protocols.

## Installation

```bash
npm install fresh-ts
```

## Quick Start

```typescript
import { FeverClient } from 'fresh-ts';

const client = await FeverClient.create({
  host: 'https://your-freshrss-instance.com',
  username: 'your-username',
  password: 'your-password',
  debug: true // optional
});

// Get unread items
const unreadItems = await client.getUnreads();
console.log(`You have ${unreadItems.length} unread items`);
```

## API Documentation

### FeverClient

The FeverClient provides access to FreshRSS using the Fever API protocol.

#### Constructor Options

```typescript
interface FreshRSSOptions {
  host: string;          // Your FreshRSS instance URL
  username?: string;     // Your FreshRSS username
  password?: string;     // Your FreshRSS password  
  debug?: boolean;       // Enable debug logging (default: false)
}
```

#### Factory Method

```typescript
static async create(options: FreshRSSOptions): Promise<FeverClient>
```

Creates and authenticates a new FeverClient instance. This method handles API key generation and initial authentication.

**Example:**
```typescript
const client = await FeverClient.create({
  host: 'https://freshrss.example.com',
  username: 'alice',
  password: 'secret123'
});
```

#### Methods

##### Feed and Group Management

```typescript
async getFeeds(): Promise<any>
```
Retrieves all feeds from your FreshRSS instance.

```typescript
async getGroups(): Promise<any>
```
Retrieves all feed groups/categories.

##### Item Retrieval

```typescript
async getUnreads(): Promise<Item[]>
```
Gets all unread items across all feeds.

```typescript
async getSaved(): Promise<Item[]>
```
Gets all saved/starred items.

```typescript
async getItemsFromIds(ids: number[]): Promise<Item[]>
```
Retrieves specific items by their IDs. Processes requests in batches of 50 for efficiency.

**Parameters:**
- `ids` - Array of item IDs to retrieve

**Example:**
```typescript
const items = await client.getItemsFromIds([1739651633562383, 1739651633562384]);
```

```typescript
async getItemsFromDates(since: DateInput, until?: DateInput): Promise<Item[]>
```
Retrieves items within a specific date range.

**Parameters:**
- `since` - Start date (string, Date, or timestamp)
- `until` - End date (optional, defaults to now)

**Examples:**
```typescript
// Get items from last 7 days
const endDate = new Date();
const startDate = new Date();
startDate.setDate(endDate.getDate() - 7);
const items = await client.getItemsFromDates(startDate, endDate);

// Using date strings
const items = await client.getItemsFromDates('2024-01-01', '2024-01-31');

// Since yesterday until now
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const items = await client.getItemsFromDates(yesterday);
```

##### Item Actions

```typescript
async setMark(action: MarkAction, id: string | number): Promise<any>
```
Marks an item with the specified action.

**Parameters:**
- `action` - One of: `'read'`, `'saved'`, `'unsaved'`
- `id` - The item ID to mark

**Note:** The Fever API does not support marking items as 'unread'.

**Examples:**
```typescript
// Mark item as read
await client.setMark('read', 1739651633562383);

// Save an item
await client.setMark('saved', 1739651633562383);

// Unsave an item
await client.setMark('unsaved', 1739651633562383);
```

#### Data Types

```typescript
interface Item {
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

type MarkAction = 'read' | 'saved' | 'unsaved' | 'unread';
type DateInput = string | number | Date | null;
```

## Environment Variables

You can use environment variables instead of passing credentials directly:

```bash
FRESHRSS_API_HOST=https://your-freshrss-instance.com
FRESHRSS_API_USERNAME=your-username
FRESHRSS_API_PASSWORD=your-password
```

```typescript
// Will use environment variables
const client = await FeverClient.create({});
```

## Complete Example

```typescript
import { FeverClient } from 'fresh-ts';

async function main() {
  try {
    // Create authenticated client
    const client = await FeverClient.create({
      host: 'https://freshrss.example.com',
      username: 'alice',
      password: 'secret123'
    });

    // Get feed information
    const feeds = await client.getFeeds();
    console.log(`Found ${feeds.feeds?.length || 0} feeds`);

    // Get unread items
    const unreadItems = await client.getUnreads();
    console.log(`${unreadItems.length} unread items`);

    // Get items from last week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentItems = await client.getItemsFromDates(weekAgo);
    console.log(`${recentItems.length} items from last week`);

    // Mark first unread item as saved
    if (unreadItems.length > 0) {
      await client.setMark('saved', unreadItems[0].id);
      console.log('Marked first unread item as saved');
    }

    // Get all saved items
    const savedItems = await client.getSaved();
    console.log(`${savedItems.length} saved items`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
```

## Error Handling

The client throws specific error types:

- `AuthenticationError` - Invalid credentials or authentication failure
- `APIError` - API-related errors (e.g., malformed responses)
- `Error` - General errors (network issues, invalid parameters)

```typescript
import { FeverClient, AuthenticationError, APIError } from 'fresh-ts';

try {
  const client = await FeverClient.create(options);
  const items = await client.getUnreads();
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof APIError) {
    console.error('API error:', error.message);
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

## Requirements

- Node.js 18+ (for native fetch support)
- FreshRSS instance with Fever API enabled

## License

MIT © [Niklas Wockenfuß](https://niklaswockenfuss.de/)
