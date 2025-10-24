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
                    console.log('=== SCRAPING BODY TEXT WITH ELEMENT TRACKING ===');
                    
                    // Wait for all content to load
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    // Get body text with element source tracking
                    const textWithSources = await page.evaluate(() => {
                        const result = {
                            fullText: '',
                            elementSources: [],
                            textChunks: []
                        };
                        
                        // Get all text-containing elements
                        const textElements = document.querySelectorAll('*');
                        let currentPosition = 0;
                        
                        textElements.forEach((element, index) => {
                            // Skip script, style, and other non-text elements
                            if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'META', 'LINK', 'IMG', 'SVG', 'CANVAS'].includes(element.tagName)) {
                                return;
                            }
                            
                            const text = element.textContent || element.innerText || '';
                            const trimmedText = text.trim();
                            
                            // Only process elements with meaningful text (more than 10 characters)
                            if (trimmedText.length > 10) {
                                // Check if this text is not just a duplicate of parent text
                                const parentText = element.parentElement ? (element.parentElement.textContent || '').trim() : '';
                                if (trimmedText !== parentText) {
                                    const elementInfo = {
                                        tagName: element.tagName,
                                        className: element.className,
                                        id: element.id,
                                        textLength: trimmedText.length,
                                        textPreview: trimmedText.substring(0, 100),
                                        startPosition: currentPosition,
                                        endPosition: currentPosition + trimmedText.length,
                                        attributes: {
                                            'data-testid': element.getAttribute('data-testid'),
                                            'data-value': element.getAttribute('data-value'),
                                            'role': element.getAttribute('role'),
                                            'aria-label': element.getAttribute('aria-label')
                                        },
                                        isVisible: element.offsetParent !== null,
                                        boundingRect: element.getBoundingClientRect()
                                    };
                                    
                                    result.elementSources.push(elementInfo);
                                    result.textChunks.push({
                                        text: trimmedText,
                                        elementIndex: result.elementSources.length - 1
                                    });
                                    
                                    currentPosition += trimmedText.length + 1; // +1 for space
                                }
                            }
                        });
                        
                        // Get the full body text
                        result.fullText = document.body.textContent || document.body.innerText || '';
                        
                        return result;
                    });
                    
                    // Set the summary to the full text
                    summary = textWithSources.fullText;
                    
                    console.log('=== ELEMENT SOURCE ANALYSIS ===');
                    console.log('Total body text length:', summary.length);
                    console.log('Number of text elements found:', textWithSources.elementSources.length);
                    
                    // Log the most significant text elements (by length)
                    const significantElements = textWithSources.elementSources
                        .sort((a, b) => b.textLength - a.textLength)
                        .slice(0, 20); // Top 20 elements by text length
                    
                    console.log('=== TOP 20 ELEMENTS BY TEXT LENGTH ===');
                    significantElements.forEach((element, index) => {
                        console.log(`\n--- Element ${index + 1} ---`);
                        console.log(`Tag: ${element.tagName}`);
                        console.log(`Class: ${element.className}`);
                        console.log(`ID: ${element.id}`);
                        console.log(`Text Length: ${element.textLength}`);
                        console.log(`Text Preview: ${element.textPreview}`);
                        console.log(`Position: ${element.startPosition}-${element.endPosition}`);
                        console.log(`Visible: ${element.isVisible}`);
                        console.log(`Attributes:`, element.attributes);
                        console.log(`Bounding Rect:`, element.boundingRect);
                    });
                    
                    // Look for elements with specific patterns that might be important
                    const importantElements = textWithSources.elementSources.filter(el => 
                        el.attributes['data-value'] || 
                        el.attributes['data-testid'] ||
                        el.className.includes('summary') ||
                        el.className.includes('content') ||
                        el.className.includes('transcript') ||
                        el.className.includes('conversation') ||
                        el.textLength > 200
                    );
                    
                    console.log('\n=== IMPORTANT ELEMENTS (with data attributes or key classes) ===');
                    importantElements.forEach((element, index) => {
                        console.log(`\n--- Important Element ${index + 1} ---`);
                        console.log(`Tag: ${element.tagName}`);
                        console.log(`Class: ${element.className}`);
                        console.log(`ID: ${element.id}`);
                        console.log(`Text Length: ${element.textLength}`);
                        console.log(`Text Preview: ${element.textPreview}`);
                        console.log(`Attributes:`, element.attributes);
                    });
                    
                    console.log('\n=== FULL TEXT PREVIEWS ===');
                    console.log('First 500 chars:', summary.substring(0, 500));
                    console.log('Last 500 chars:', summary.substring(Math.max(0, summary.length - 500)));
                    
                } catch (error) {
                    console.log('ERROR: Error extracting body text with element tracking:', error.message);
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
