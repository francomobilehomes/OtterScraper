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
                let pageTitle = "Unknown Title";
                let createdDate = "Unknown Date";
                
                try {
                    console.log('=== TARGETING TRANSCRIPT ELEMENTS ===');
                    
                    // Wait for all content to load
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    // Get the page title first
                    pageTitle = await page.title();
                    
                    // Try to get the creation date
                    try {
                        const dateElement = await page.$('span[data-label="true"].flex.truncate.only\\:mx-auto.px-0\\.5');
                        if (dateElement) {
                            const dateText = await page.evaluate(el => el.textContent || el.innerText || '', dateElement);
                            if (dateText && dateText.trim()) {
                                createdDate = dateText.trim();
                                console.log('Found creation date:', createdDate);
                            }
                        } else {
                            console.log('Date element not found');
                        }
                    } catch (dateError) {
                        console.log('Error extracting date:', dateError.message);
                    }
                    
                    // Target the specific transcript element and related elements
                    const transcriptData = await page.evaluate(() => {
                        const result = {
                            transcriptText: '',
                            transcriptElements: [],
                            allTranscriptText: ''
                        };
                        
                        // First, try to get the main transcript block
                        const transcriptBlock = document.getElementById('transcript-block');
                        if (transcriptBlock) {
                            console.log('Found transcript-block element');
                            const blockText = transcriptBlock.textContent || transcriptBlock.innerText || '';
                            result.transcriptText = blockText;
                            result.transcriptElements.push({
                                id: 'transcript-block',
                                className: transcriptBlock.className,
                                textLength: blockText.length,
                                textPreview: blockText.substring(0, 200)
                            });
                        }
                        
                        // Look for other transcript-related elements
                        const transcriptSelectors = [
                            '[id*="transcript"]',
                            '[class*="transcript"]',
                            '[data-testid*="transcript"]',
                            '[role="transcript"]',
                            '[aria-label*="transcript" i]',
                            'div[class*="otter-scrollbar"]',
                            'div[class*="overflow-y-auto"]'
                        ];
                        
                        transcriptSelectors.forEach(selector => {
                            try {
                                const elements = document.querySelectorAll(selector);
                                elements.forEach(element => {
                                    const text = element.textContent || element.innerText || '';
                                    if (text.length > 100) { // Only significant text elements
                                        result.transcriptElements.push({
                                            selector: selector,
                                            tagName: element.tagName,
                                            id: element.id,
                                            className: element.className,
                                            textLength: text.length,
                                            textPreview: text.substring(0, 200),
                                            isVisible: element.offsetParent !== null
                                        });
                                        
                                        // Add to combined transcript text if it's not already included
                                        if (!result.allTranscriptText.includes(text.substring(0, 100))) {
                                            result.allTranscriptText += text + '\n';
                                        }
                                    }
                                });
                            } catch (e) {
                                console.log(`Selector ${selector} failed:`, e.message);
                            }
                        });
                        
                        // If we found the main transcript block, use that
                        if (result.transcriptText) {
                            result.allTranscriptText = result.transcriptText;
                        }
                        
                        return result;
                    });
                    
                    // Use the transcript text as our summary
                    summary = transcriptData.allTranscriptText || transcriptData.transcriptText || 'No transcript found';
                    
                    console.log('=== TRANSCRIPT EXTRACTION RESULTS ===');
                    console.log('Main transcript text length:', transcriptData.transcriptText.length);
                    console.log('Combined transcript text length:', transcriptData.allTranscriptText.length);
                    console.log('Number of transcript elements found:', transcriptData.transcriptElements.length);
                    
                    console.log('\n=== TRANSCRIPT ELEMENTS FOUND ===');
                    transcriptData.transcriptElements.forEach((element, index) => {
                        console.log(`\n--- Transcript Element ${index + 1} ---`);
                        console.log(`Selector: ${element.selector || 'N/A'}`);
                        console.log(`Tag: ${element.tagName}`);
                        console.log(`ID: ${element.id || 'N/A'}`);
                        console.log(`Class: ${element.className}`);
                        console.log(`Text Length: ${element.textLength}`);
                        console.log(`Text Preview: ${element.textPreview}`);
                        console.log(`Visible: ${element.isVisible}`);
                    });
                    
                    console.log('\n=== TRANSCRIPT TEXT PREVIEW ===');
                    console.log('First 1000 chars:', summary.substring(0, 1000));
                    console.log('Last 1000 chars:', summary.substring(Math.max(0, summary.length - 1000)));
                    
                } catch (error) {
                    console.log('ERROR: Error extracting transcript:', error.message);
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
                        title: pageTitle || 'Unknown Title',
                        summary: summary,
                        createdDate: createdDate,
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
                        title: 'Unknown Title',
                        summary: "Unable to scrape",
                        createdDate: "Unknown Date",
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
                title: 'Unknown Title',
                summary: "Unable to scrape",
                createdDate: "Unknown Date",
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
