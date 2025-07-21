// Enhanced web scraping functionality
const puppeteer = require('puppeteer');

class EnhancedScraper {
    constructor() {
        this.browser = null;
    }

    async initBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ],
                headless: true,
                timeout: 30000
            });
        }
        return this.browser;
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    // Check robots.txt compliance
    async checkRobotsTxt(url) {
        try {
            const urlObj = new URL(url);
            const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
            
            const page = await (await this.initBrowser()).newPage();
            const response = await page.goto(robotsUrl, { timeout: 10000 });
            
            if (response && response.ok()) {
                const robotsContent = await page.content();
                await page.close();
                
                // Simple robots.txt parsing (can be enhanced)
                const lines = robotsContent.split('\n');
                let userAgentMatch = false;
                let allowed = true;
                
                for (const line of lines) {
                    const trimmed = line.trim().toLowerCase();
                    if (trimmed.startsWith('user-agent:')) {
                        userAgentMatch = trimmed.includes('*') || trimmed.includes('puppeteer');
                    }
                    if (userAgentMatch && trimmed.startsWith('disallow:')) {
                        const disallowPath = trimmed.split(':')[1].trim();
                        if (disallowPath === '/' || urlObj.pathname.startsWith(disallowPath)) {
                            allowed = false;
                            break;
                        }
                    }
                }
                
                return { allowed, robotsTxt: robotsContent };
            }
            
            await page.close();
            return { allowed: true, robotsTxt: null };
        } catch (error) {
            return { allowed: true, robotsTxt: null, error: error.message };
        }
    }

    // Enhanced content extraction
    async scrapeEnhanced(url, options = {}) {
        const browser = await this.initBrowser();
        const page = await browser.newPage();
        
        try {
            // Check robots.txt first
            const robotsCheck = await this.checkRobotsTxt(url);
            if (!robotsCheck.allowed) {
                return {
                    success: false,
                    error: 'Scraping disallowed by robots.txt',
                    robotsTxt: robotsCheck.robotsTxt
                };
            }

            // Set realistic user agent and viewport
            await page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            );
            await page.setViewport({ width: 1920, height: 1080 });

            // Navigate with advanced options
            const response = await page.goto(url, { 
                waitUntil: options.waitUntil || 'networkidle0',
                timeout: options.timeout || 30000 
            });

            if (!response.ok()) {
                return {
                    success: false,
                    error: `HTTP ${response.status()}: ${response.statusText()}`
                };
            }

            // Wait for specific selector if provided
            if (options.waitFor) {
                try {
                    await page.waitForSelector(options.waitFor, { timeout: 10000 });
                } catch (e) {
                    console.warn(`Wait selector "${options.waitFor}" not found`);
                }
            }

            // Enhanced data extraction
            const data = await page.evaluate((opts) => {
                // Helper functions
                function getMetaContent(name) {
                    const meta = document.querySelector(`meta[name="${name}"], meta[property="${name}"], meta[property="og:${name}"]`);
                    return meta ? meta.getAttribute('content') : null;
                }

                function extractStructuredData() {
                    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
                    const structuredData = [];
                    
                    jsonLdScripts.forEach(script => {
                        try {
                            const data = JSON.parse(script.textContent);
                            structuredData.push(data);
                        } catch (e) {
                            // Invalid JSON-LD, skip
                        }
                    });
                    
                    return structuredData;
                }

                function findMainContent() {
                    // Try to find main content area
                    const selectors = [
                        'main', 'article', '[role="main"]', 
                        '.content', '.main-content', '#content', '#main',
                        '.post-content', '.entry-content', '.article-content'
                    ];
                    
                    for (const selector of selectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            return {
                                text: element.innerText?.trim() || '',
                                html: element.innerHTML
                            };
                        }
                    }
                    
                    return null;
                }

                function extractImages() {
                    const images = Array.from(document.querySelectorAll('img[src]'));
                    return images.slice(0, 20).map(img => ({
                        src: img.src,
                        alt: img.alt || '',
                        width: img.naturalWidth || null,
                        height: img.naturalHeight || null
                    }));
                }

                function extractTables() {
                    const tables = Array.from(document.querySelectorAll('table'));
                    return tables.slice(0, 5).map((table, index) => {
                        const rows = Array.from(table.querySelectorAll('tr'));
                        const data = rows.map(row => {
                            return Array.from(row.querySelectorAll('td, th')).map(cell => cell.innerText.trim());
                        });
                        return { id: index, data };
                    });
                }

                // Basic page info
                const result = {
                    url: window.location.href,
                    title: document.title,
                    description: getMetaContent('description'),
                    keywords: getMetaContent('keywords'),
                    author: getMetaContent('author'),
                    
                    // Open Graph data
                    openGraph: {
                        title: getMetaContent('og:title'),
                        description: getMetaContent('og:description'),
                        image: getMetaContent('og:image'),
                        url: getMetaContent('og:url'),
                        type: getMetaContent('og:type')
                    },

                    // Headers hierarchy
                    headers: {
                        h1: Array.from(document.querySelectorAll('h1')).map(h => h.innerText.trim()),
                        h2: Array.from(document.querySelectorAll('h2')).map(h => h.innerText.trim()),
                        h3: Array.from(document.querySelectorAll('h3')).map(h => h.innerText.trim())
                    },

                    // Links
                    links: Array.from(document.querySelectorAll('a[href]')).slice(0, 50).map(a => ({
                        text: a.innerText.trim(),
                        href: a.href,
                        title: a.title || null
                    })).filter(link => link.text),

                    // Enhanced content
                    mainContent: findMainContent(),
                    
                    // Media
                    images: extractImages(),
                    
                    // Structured data
                    structuredData: extractStructuredData(),
                    
                    // Tables
                    tables: extractTables(),

                    // Page metrics
                    wordCount: document.body.innerText.split(/\s+/).length,
                    language: document.documentElement.lang || document.querySelector('meta[http-equiv="content-language"]')?.content,
                    
                    // Technical info
                    charset: document.characterSet,
                    lastModified: document.lastModified
                };

                // Handle specific extraction options
                if (opts.selector) {
                    const elements = document.querySelectorAll(opts.selector);
                    result.customSelection = Array.from(elements).map(el => ({
                        text: el.innerText?.trim() || '',
                        html: el.innerHTML,
                        tagName: el.tagName.toLowerCase()
                    }));
                }

                if (opts.type === 'text') {
                    return document.body.innerText;
                }
                
                if (opts.type === 'html') {
                    return document.documentElement.outerHTML;
                }

                return result;
            }, options);

            // Performance metrics
            const metrics = await page.metrics();
            
            await page.close();

            return {
                success: true,
                data: data,
                metadata: {
                    scrapeTime: new Date().toISOString(),
                    responseTime: response.headers()['server-timing'] || null,
                    robotsCompliant: robotsCheck.allowed,
                    performance: {
                        JSHeapUsedSize: metrics.JSHeapUsedSize,
                        JSHeapTotalSize: metrics.JSHeapTotalSize,
                        ScriptDuration: metrics.ScriptDuration
                    }
                }
            };

        } catch (error) {
            await page.close();
            return {
                success: false,
                error: error.message,
                stack: error.stack
            };
        }
    }

    // Batch scraping for multiple URLs
    async scrapeBatch(urls, options = {}) {
        const results = [];
        const batchSize = options.batchSize || 3;
        
        for (let i = 0; i < urls.length; i += batchSize) {
            const batch = urls.slice(i, i + batchSize);
            const batchResults = await Promise.allSettled(
                batch.map(url => this.scrapeEnhanced(url, options))
            );
            
            results.push(...batchResults.map((result, index) => ({
                url: batch[index],
                result: result.status === 'fulfilled' ? result.value : { success: false, error: result.reason }
            })));
        }
        
        return results;
    }
}

module.exports = { EnhancedScraper };