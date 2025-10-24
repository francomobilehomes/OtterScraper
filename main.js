const { Actor } = require('apify');
const { PuppeteerCrawler } = require('crawlee');

Actor.main(async () => {
    // Get input from Apify
    const input = await Actor.getInput();
    
    if (!input || !input.url) {
        throw new Error('Please provide a URL in the input. Expected format: { "url": "https://otter.ai/u/..." }');
    }

    console.log('Starting Otter.ai scraper with URL:', input.url);

    // Create a PuppeteerCrawler
    const crawler = new PuppeteerCrawler({
        launchContext: {
            launchOptions: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        },
        async requestHandler({ page, request }) {
            console.log('Processing URL:', request.url);
            
            try {
                // Navigate to the page
                await page.goto(request.url, { waitUntil: 'networkidle0' });
                
                // Wait a bit more for dynamic content to load
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                let summary = "Unable to scrape";
                
                try {
                    console.log('=== ATTEMPTING TO SCRAPE SUMMARY ===');
                    
                    // Try to find the specific div with the data-value attribute
                    const summaryElement = await page.$('div.grid.relative.before\\:block.before\\:content-\\[attr\\(data-value\\)\\].before\\:whitespace-pre-wrap.before\\:invisible.before\\:col-start-1.before\\:col-end-2.before\\:row-start-1.before\\:row-end-2.ml-8');
                    
                    if (summaryElement) {
                        console.log('SUCCESS: Found summary element with specific selector');
                        summary = await summaryElement.evaluate(el => el.getAttribute('data-value') || el.textContent || '');
                        console.log('Summary extracted:', summary);
                    } else {
                        console.log('FAILED: Could not find summary element with specific selector');
                        
                        // Try a simpler approach - look for any div with data-value attribute
                        const dataValueElement = await page.$('div[data-value]');
                        if (dataValueElement) {
                            console.log('SUCCESS: Found div with data-value attribute');
                            summary = await dataValueElement.evaluate(el => el.getAttribute('data-value') || el.textContent || '');
                            console.log('Summary from data-value:', summary);
                        } else {
                            console.log('FAILED: No div with data-value attribute found');
                        }
                    }
                } catch (error) {
                    console.log('ERROR: Error extracting summary:', error.message);
                }
                
                // Clean up the summary
                if (summary && summary.trim() && summary !== "Unable to scrape") {
                    summary = summary.trim();
                } else {
                    summary = "Unable to scrape";
                }
                
                console.log('Final summary result:', summary);
                
                // Save the result
                const result = {
                    url: request.url,
                    summary: summary,
                    scrapedAt: new Date().toISOString()
                };
                
                // Save to Apify dataset
                await Actor.pushData(result);
                console.log('Result saved:', result);
                
            } catch (error) {
                console.error('Error processing page:', error);
                
                // Save error result
                const errorResult = {
                    url: request.url,
                    summary: "Unable to scrape",
                    error: error.message,
                    scrapedAt: new Date().toISOString()
                };
                
                // Save to Apify dataset
                await Actor.pushData(errorResult);
            }
        },
        async failedRequestHandler({ request, error }) {
            console.error('Request failed:', request.url, error.message);
            
            const errorResult = {
                url: request.url,
                summary: "Unable to scrape",
                error: error.message,
                scrapedAt: new Date().toISOString()
            };
            
            await Actor.pushData(errorResult);
        }
    });

    // Add the URL to the request queue
    await crawler.addRequests([{
        url: input.url,
        userData: { label: 'otter-conversation' }
    }]);

    // Run the crawler
    await crawler.run();

    console.log('Scraping completed!');
});
