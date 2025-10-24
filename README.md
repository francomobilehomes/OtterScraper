# Otter.ai Scraper

An Apify actor that scrapes conversation titles from Otter.ai URLs.

## Usage

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the actor:
   ```bash
   npm start
   ```

## Input

The actor expects a JSON input with a `url` field containing an Otter.ai conversation URL:

```json
{
  "url": "https://otter.ai/u/06FBGY1S0ZF_GnmZs8CQWWiGf4Q?utm_source=copy_url"
}
```

## Output

The actor outputs a dataset containing:
- `url`: The scraped URL
- `title`: The conversation title (or "Unable to scrape" if extraction fails)
- `scrapedAt`: Timestamp of when the scraping occurred

## Features

- Uses Puppeteer for dynamic content loading
- Multiple fallback strategies for title extraction
- Error handling and logging
- Returns "Unable to scrape" if title cannot be found
