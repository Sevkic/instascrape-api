const puppeteer = require('puppeteer');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const robotsParser = require('robotstxt');

class Scraper {
  constructor() {
    // Blacklisted domains for legal protection
    this.blacklistedDomains = [
      'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
      'linkedin.com', 'tiktok.com', 'pinterest.com',
      'google.com', 'youtube.com', 'amazon.com', 'ebay.com',
      'netflix.com', 'spotify.com', 'paypal.com',
      'github.com', 'stackoverflow.com'
    ];
    
    this.browser = null;
  }

  // Check if URL is allowed
  async validateUrl(url) {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase().replace(/^www\./, '');
      
      // Check blacklist
      const isBlacklisted = this.blacklistedDomains.some(blocked => 
        domain.includes(blocked) || blocked.includes(domain)
      );
      
      if (isBlacklisted) {
        return {
          valid: false,
          reason: `Domain ${domain} is blacklisted for legal protection`,
          suggestion: 'Try a different website that allows scraping'
        };
      }

      // Check robots.txt
      try {
        const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
        const robotsResponse = await fetch(robotsUrl);
        if (robotsResponse.ok) {
          const robotsText = await robotsResponse.text();
          const robots = robotsParser(robotsUrl, robotsText);
          
          if (!robots.isAllowed('*', url)) {
            return {
              valid: false,
              reason: 'Blocked by robots.txt',
              suggestion: 'This website prohibits scraping. Please respect their robots.txt file.'
            };
          }
        }
      } catch (robotsError) {
        // If robots.txt check fails, warn but allow
        console.log('Could not check robots.txt:', robotsError.message);
      }

      return { valid: true, reason: 'URL validated successfully' };
    } catch (error) {
      return { valid: false, reason: 'Invalid URL format' };
    }
  }

  async scrapeWebsite(options, progressCallback) {
    const { url, dataTypes, maxPages = 1, format = 'csv', customSelectors = {} } = options;
    
    // Validate URL first
    const validation = await this.validateUrl(url);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    let results = [];
    
    try {
      // Launch browser
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await this.browser.newPage();
      
      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      let currentUrl = url;
      
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        progressCallback?.({
          page: pageNum,
          total: maxPages,
          status: `Scraping page ${pageNum}...`,
          percentage: Math.round((pageNum - 1) / maxPages * 100)
        });

        try {
          await page.goto(currentUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
          });

          // Wait a bit to be respectful
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Extract data based on selected types
          const pageData = await this.extractData(page, dataTypes, customSelectors);
          results.push(...pageData);

          // Try to find next page if maxPages > 1
          if (pageNum < maxPages) {
            try {
              const nextUrl = await this.findNextPage(page, currentUrl);
              if (nextUrl) {
                currentUrl = nextUrl;
              } else {
                break; // No more pages
              }
            } catch (nextError) {
              console.log('Could not find next page:', nextError.message);
              break;
            }
          }
        } catch (pageError) {
          console.error(`Error on page ${pageNum}:`, pageError.message);
          continue;
        }
      }

      progressCallback?.({
        page: maxPages,
        total: maxPages,
        status: `Completed! Found ${results.length} items.`,
        percentage: 100
      });

      return {
        success: true,
        data: results,
        totalItems: results.length,
        pagesScraped: Math.min(pageNum, maxPages)
      };

    } catch (error) {
      throw new Error(`Scraping failed: ${error.message}`);
    } finally {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    }
  }

  async extractData(page, dataTypes, customSelectors) {
    return await page.evaluate((types, selectors) => {
      const results = [];
      
      // Smart selectors for common data types
      const defaultSelectors = {
        titles: ['h1', 'h2', 'h3', '.title', '[data-title]', '.product-title', '.article-title'],
        prices: ['.price', '.cost', '[data-price]', '.amount', '.value'],
        images: ['img'],
        links: ['a[href]'],
        descriptions: ['.description', '.summary', '.excerpt', 'p'],
        dates: ['.date', '.time', '[datetime]', '.published'],
        categories: ['.category', '.tag', '.label', '.badge']
      };

      // Try to find repeating elements (like product cards, articles, etc.)
      const containerSelectors = [
        '.item', '.card', '.product', '.article', '.post', '.entry',
        '[data-item]', '.result', '.listing', '.box'
      ];

      let containers = [];
      
      // Find the best container selector
      for (const selector of containerSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 1) {
          containers = Array.from(elements);
          break;
        }
      }

      // If no containers found, treat whole page as one item
      if (containers.length === 0) {
        containers = [document.body];
      }

      containers.forEach((container, index) => {
        const item = { id: index + 1 };

        types.forEach(type => {
          const customSelector = selectors[type];
          const selectorsToTry = customSelector ? [customSelector] : defaultSelectors[type] || [];
          
          for (const selector of selectorsToTry) {
            const element = container.querySelector(selector);
            if (element) {
              if (type === 'images') {
                item[type] = element.src || element.getAttribute('data-src') || '';
              } else if (type === 'links') {
                item[type] = element.href || '';
              } else {
                item[type] = element.textContent?.trim() || '';
              }
              break;
            }
          }
          
          // If nothing found, set empty value
          if (!(type in item)) {
            item[type] = '';
          }
        });

        // Only add items that have at least some data
        const hasData = Object.values(item).some(value => value && value !== '');
        if (hasData) {
          results.push(item);
        }
      });

      return results;
    }, dataTypes, customSelectors);
  }

  async findNextPage(page, currentUrl) {
    // Try to find next page link
    const nextSelectors = [
      'a[aria-label*="next" i]',
      'a[title*="next" i]',
      'a:contains("Next")',
      'a:contains(">")',
      '.pagination .next',
      '.pager .next',
      '[data-next]'
    ];

    for (const selector of nextSelectors) {
      try {
        const nextLink = await page.$eval(selector, el => el.href);
        if (nextLink && nextLink !== currentUrl) {
          return nextLink;
        }
      } catch (e) {
        continue;
      }
    }

    return null;
  }

  async saveAsCSV(data, filePath) {
    if (!data || data.length === 0) {
      throw new Error('No data to save');
    }

    // Get all unique keys from the data
    const headers = [...new Set(data.flatMap(Object.keys))];
    
    const csvWriter = createCsvWriter({
      path: filePath,
      header: headers.map(key => ({ id: key, title: key }))
    });

    await csvWriter.writeRecords(data);
  }
}

module.exports = { Scraper };