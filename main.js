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
                    console.log('=== PAGE INSPECTION FOR DEBUGGING ===');
                    
                    // First, let's inspect the page structure
                    const pageInfo = await page.evaluate(() => {
                        const info = {
                            title: document.title,
                            url: window.location.href,
                            bodyText: document.body.textContent.substring(0, 500),
                            allDivs: [],
                            elementsWithDataValue: [],
                            elementsWithClassName: [],
                            allClasses: new Set()
                        };
                        
                        // Get all divs and their classes
                        const divs = document.querySelectorAll('div');
                        divs.forEach((div, index) => {
                            if (index < 50) { // Limit to first 50 divs
                                const divInfo = {
                                    index: index,
                                    className: div.className,
                                    textContent: div.textContent.substring(0, 100),
                                    hasDataValue: div.hasAttribute('data-value'),
                                    dataValue: div.getAttribute('data-value')
                                };
                                info.allDivs.push(divInfo);
                                
                                // Collect all unique classes
                                if (div.className) {
                                    div.className.split(' ').forEach(cls => {
                                        if (cls.trim()) info.allClasses.add(cls.trim());
                                    });
                                }
                            }
                        });
                        
                        // Get elements with data-value attribute
                        const dataValueElements = document.querySelectorAll('[data-value]');
                        dataValueElements.forEach((el, index) => {
                            info.elementsWithDataValue.push({
                                tagName: el.tagName,
                                className: el.className,
                                dataValue: el.getAttribute('data-value'),
                                textContent: el.textContent.substring(0, 100)
                            });
                        });
                        
                        // Look for elements with specific class patterns
                        const classPatterns = [
                            'grid',
                            'relative',
                            'before:block',
                            'before:content',
                            'data-value',
                            'ml-8'
                        ];
                        
                        classPatterns.forEach(pattern => {
                            const elements = document.querySelectorAll(`[class*="${pattern}"]`);
                            elements.forEach((el, index) => {
                                if (index < 10) { // Limit results
                                    info.elementsWithClassName.push({
                                        pattern: pattern,
                                        tagName: el.tagName,
                                        className: el.className,
                                        textContent: el.textContent.substring(0, 100)
                                    });
                                }
                            });
                        });
                        
                        return info;
                    });
                    
                    console.log('Page Title:', pageInfo.title);
                    console.log('Page URL:', pageInfo.url);
                    console.log('Body Text Preview:', pageInfo.bodyText);
                    console.log('Elements with data-value attribute:', pageInfo.elementsWithDataValue);
                    console.log('Elements with relevant class patterns:', pageInfo.elementsWithClassName);
                    console.log('All unique classes found:', Array.from(pageInfo.allClasses).slice(0, 20));
                    console.log('First 10 divs:', pageInfo.allDivs.slice(0, 10));
                    
                    console.log('=== END PAGE INSPECTION ===');
                    
                    // Now try to find the summary element based on what we found
                    console.log('=== ATTEMPTING TO SCRAPE SUMMARY ===');
                    
                    let summaryElement = null;
                    
                    // Approach 1: Look for div with the full className
                    summaryElement = await page.$('div[class*="grid relative before:block before:content-[attr(data-value)] before:whitespace-pre-wrap before:invisible before:col-start-1 before:col-end-2 before:row-start-1 before:row-end-2 ml-8"]');
                    if (summaryElement) {
                        console.log('SUCCESS: Found summary element with full className');
                    } else {
                        console.log('FAILED: Could not find element with full className');
                        
                        // Approach 2: Look for div with data-value attribute
                        summaryElement = await page.$('div[data-value]');
                        if (summaryElement) {
                            console.log('SUCCESS: Found div with data-value attribute');
                        } else {
                            console.log('FAILED: No div with data-value attribute found');
                            
                            // Approach 3: Look for any element with the key className parts
                            summaryElement = await page.$('div[class*="before:content-[attr(data-value)]"]');
                            if (summaryElement) {
                                console.log('SUCCESS: Found element with before:content-[attr(data-value)] pattern');
                            } else {
                                console.log('FAILED: No element with before:content-[attr(data-value)] pattern found');
                            }
                        }
                    }
                    
                    if (summaryElement) {
                        summary = await summaryElement.evaluate(el => el.getAttribute('data-value') || el.textContent || '');
                        console.log('Summary extracted:', summary);
                    }
                } catch (error) {
                    console.log('ERROR: Error during page inspection or summary extraction:', error.message);
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
