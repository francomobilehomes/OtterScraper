const Apify = require('apify');

async function main() {
    // Get input from Apify
    let input;
    try {
        input = JSON.parse(process.env.APIFY_INPUT || '{}');
    } catch (error) {
        console.log('Error parsing input:', error);
        input = {};
    }
    
    // Debug: Log what we received
    console.log('Received input:', input);
    console.log('APIFY_INPUT env var:', process.env.APIFY_INPUT);
    
    if (!input || !input.url) {
        throw new Error('Please provide a URL in the input. Expected format: { "url": "https://otter.ai/u/..." }');
    }

    console.log('Starting Otter.ai scraper with URL:', input.url);

    // Create a dataset to store results
    const dataset = await Apify.openDataset();

    // Create a PuppeteerCrawler
    const crawler = new Apify.PuppeteerCrawler({
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
                await page.waitForTimeout(3000);
                
                let title = "Unable to scrape";
                
                try {
                    // Try the specific selector path first
                    const titleElement = await page.$('#main-content > div.otter-main-content__container > app-conversation-detail > div:nth-child(1) > app-speech-header > div > div > div.flex.items-center.justify-between > form > input');
                    
                    if (titleElement) {
                        title = await titleElement.evaluate(el => el.value || el.textContent || '');
                    } else {
                        // Try alternative selector by class
                        const titleByClass = await page.$('input.text-3xl.px-2.rounded-sm.truncate.bg-white.border.border-transparent.text-default.w-full.transition-colors.hover\\:bg-\\[\\#F6F7F9\\].focus\\:bg-default.focus\\:border-subtle.focus\\:outline-none');
                        
                        if (titleByClass) {
                            title = await titleByClass.evaluate(el => el.value || el.textContent || '');
                        } else {
                            // Try a more general approach - look for any input with the specific classes
                            const generalTitle = await page.evaluate(() => {
                                const inputs = document.querySelectorAll('input');
                                for (let input of inputs) {
                                    if (input.classList.contains('text-3xl') && 
                                        input.classList.contains('px-2') && 
                                        input.classList.contains('rounded-sm')) {
                                        return input.value || input.textContent || '';
                                    }
                                }
                                return null;
                            });
                            
                            if (generalTitle) {
                                title = generalTitle;
                            }
                        }
                    }
                } catch (error) {
                    console.log('Error extracting title:', error.message);
                }
                
                // Clean up the title
                if (title && title.trim() && title !== "Unable to scrape") {
                    title = title.trim();
                } else {
                    title = "Unable to scrape";
                }
                
                console.log('Extracted title:', title);
                
                // Save the result
                const result = {
                    url: request.url,
                    title: title,
                    scrapedAt: new Date().toISOString()
                };
                
                // Save to Apify dataset
                await dataset.pushData(result);
                console.log('Result saved:', result);
                
            } catch (error) {
                console.error('Error processing page:', error);
                
                // Save error result
                const errorResult = {
                    url: request.url,
                    title: "Unable to scrape",
                    error: error.message,
                    scrapedAt: new Date().toISOString()
                };
                
                // Save to Apify dataset
                await dataset.pushData(errorResult);
            }
        },
        async failedRequestHandler({ request, error }) {
            console.error('Request failed:', request.url, error.message);
            
            const errorResult = {
                url: request.url,
                title: "Unable to scrape",
                error: error.message,
                scrapedAt: new Date().toISOString()
            };
            
            await dataset.pushData(errorResult);
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
}

// Run the main function
main().catch(console.error);
