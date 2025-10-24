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
                    
                    // Look for and click three-dot button to reveal Export option
                    console.log('=== LOOKING FOR THREE-DOT BUTTON AND EXPORT OPTION ===');
                    
                    try {
                        // Look for three-dot button (common patterns)
                        const threeDotSelectors = [
                            'button[aria-label*="menu" i]',
                            'button[aria-label*="more" i]',
                            'button[aria-label*="options" i]',
                            'button[title*="menu" i]',
                            'button[title*="more" i]',
                            'button[title*="options" i]',
                            'button[class*="menu"]',
                            'button[class*="more"]',
                            'button[class*="options"]',
                            'button[class*="dots"]',
                            'button[class*="kebab"]',
                            'button[class*="ellipsis"]',
                            'button svg[class*="dots"]',
                            'button svg[class*="more"]',
                            'button svg[class*="menu"]',
                            '[data-testid*="menu"]',
                            '[data-testid*="more"]',
                            '[data-testid*="options"]',
                            'button:has(svg[class*="dots"])',
                            'button:has(svg[class*="more"])',
                            'button:has(svg[class*="menu"])'
                        ];
                        
                        let threeDotButton = null;
                        for (const selector of threeDotSelectors) {
                            try {
                                console.log(`Trying three-dot selector: ${selector}`);
                                threeDotButton = await page.$(selector);
                                if (threeDotButton) {
                                    console.log(`SUCCESS: Found three-dot button with selector: ${selector}`);
                                    break;
                                }
                            } catch (e) {
                                console.log(`Selector ${selector} failed:`, e.message);
                            }
                        }
                        
                        if (threeDotButton) {
                            console.log('Clicking three-dot button...');
                            await threeDotButton.click();
                            console.log('Three-dot button clicked');
                            
                            // Wait for menu to appear
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            
                            // Look for Export button
                            const exportSelectors = [
                                'button:has-text("Export")',
                                'a:has-text("Export")',
                                '[role="menuitem"]:has-text("Export")',
                                'div:has-text("Export")',
                                'span:has-text("Export")',
                                'button[class*="export" i]',
                                'a[class*="export" i]',
                                '[data-testid*="export" i]',
                                'button[aria-label*="export" i]',
                                'a[aria-label*="export" i]'
                            ];
                            
                            let exportButton = null;
                            for (const selector of exportSelectors) {
                                try {
                                    console.log(`Trying export selector: ${selector}`);
                                    exportButton = await page.$(selector);
                                    if (exportButton) {
                                        console.log(`SUCCESS: Found Export button with selector: ${selector}`);
                                        break;
                                    }
                                } catch (e) {
                                    console.log(`Export selector ${selector} failed:`, e.message);
                                }
                            }
                            
                            if (exportButton) {
                                console.log('Export button found! Getting text content...');
                                const exportText = await exportButton.evaluate(el => el.textContent.trim());
                                console.log('Export button text:', exportText);
                                
                                // Check if it's actually an Export button
                                if (exportText.toLowerCase().includes('export')) {
                                    console.log('CONFIRMED: Found Export button!');
                                    
                                    // Try to click it
                                    try {
                                        await exportButton.click();
                                        console.log('Export button clicked successfully');
                                        
                                        // Wait a bit to see what happens
                                        await new Promise(resolve => setTimeout(resolve, 3000));
                                        
                                        // Check if a download started or modal appeared
                                        const currentUrl = await page.url();
                                        console.log('URL after export click:', currentUrl);
                                        
                                    } catch (clickError) {
                                        console.log('Error clicking export button:', clickError.message);
                                    }
                                } else {
                                    console.log('Button found but text does not contain "Export":', exportText);
                                }
                            } else {
                                console.log('FAILED: No Export button found after clicking three-dot menu');
                                
                                // Let's see what's in the menu
                                const menuItems = await page.evaluate(() => {
                                    const items = [];
                                    const menuElements = document.querySelectorAll('[role="menuitem"], button, a, div[class*="menu"], div[class*="dropdown"]');
                                    menuElements.forEach((el, index) => {
                                        if (index < 20) { // Limit to first 20 items
                                            items.push({
                                                tagName: el.tagName,
                                                className: el.className,
                                                textContent: el.textContent.trim(),
                                                isVisible: el.offsetParent !== null
                                            });
                                        }
                                    });
                                    return items;
                                });
                                
                                console.log('Menu items found:', menuItems);
                            }
                        } else {
                            console.log('FAILED: No three-dot button found');
                        }
                        
                    } catch (error) {
                        console.log('ERROR: Error during three-dot button and export search:', error.message);
                    }
                    
                    console.log('=== END THREE-DOT AND EXPORT SEARCH ===');
                    
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
