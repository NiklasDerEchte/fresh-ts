# Fresh-ts

A TypeScript client for the FreshRSS API.

## Installation

```bash
npm install fresh-ts
```

## Usage

```typescript
import { FreshFetchClient } from 'fresh-ts';

const client = new FreshFetchClient({
  host: 'https://your-freshrss-instance.com',
  username: 'your-username',
  password: 'your-password'
});

// Get items from the last 7 days
async function main(): Promise<void> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);
    console.log(await client.getItemsFromDates(startDate, endDate));
}

main().catch(console.error);
```

## API

### Constructor Options

- `host`: Your FreshRSS instance URL
- `username`: Your FreshRSS username  
- `password`: Your FreshRSS password
- `debug`: Enable debug logging (default: false)

### Methods

- `getFeeds()`: Get all feeds
- `getGroups()`: Get all groups
- `getUnreads()`: Get unread items
- `getSaved()`: Get saved items
- `getItemsFromIds(ids)`: Get items by IDs
- `getItemsFromDates(since, until)`: Get items from date range
- `setMark(action, id)`: Mark item as read/saved/unsaved

## License

MIT © [Niklas Wockenfuß](https://niklaswockenfuss.de/)
