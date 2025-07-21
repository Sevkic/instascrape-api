const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Rate Limiting
app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Blacklisted domains (add more as needed)
const BLACKLISTED_DOMAINS = [
  'facebook.com',
  'instagram.com', 
  'twitter.com',
  'linkedin.com',
  'google.com'
];

// Pricing tiers
const PRICING = {
  basic: 500, // €5.00 in cents
  premium: 2000, // €20.00 in cents
  custom: 5000 // €50.00 in cents
};

// Helper function to validate URL
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    
    // Check if domain is blacklisted
    return !BLACKLISTED_DOMAINS.some(blocked => 
      domain.includes(blocked)
    );
  } catch {
    return false;
  }
}

// Main scraping function
async function scrapeWebsite(url, options = {}) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true
  });
  
  try {
    const page = await browser.newPage();
    
    // Set user agent to avoid blocking
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );
    
    // Navigate to URL
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Wait for specific selector if provided
    if (options.waitFor) {
      await page.waitForSelector(options.waitFor, { timeout: 10000 });
    }
    
    let result;
    
    if (options.type === 'text') {
      // Extract all text content
      result = await page.evaluate(() => {
        return document.body.innerText;
      });
    } else if (options.type === 'html') {
      // Extract HTML
      result = await page.content();
    } else if (options.selector) {
      // Extract specific elements
      result = await page.evaluate((sel) => {
        const elements = document.querySelectorAll(sel);
        return Array.from(elements).map(el => ({
          text: el.innerText,
          html: el.innerHTML,
          href: el.href || null
        }));
      }, options.selector);
    } else {
      // Default: extract basic page info
      result = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
        h1: Array.from(document.querySelectorAll('h1')).map(h => h.innerText),
        links: Array.from(document.querySelectorAll('a')).slice(0, 20).map(a => ({
          text: a.innerText,
          href: a.href
        }))
      }));
    }
    
    return { success: true, data: result };
    
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  } finally {
    await browser.close();
  }
}

// Payment verification
async function verifyPayment(paymentIntentId) {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent.status === 'succeeded';
  } catch (error) {
    return false;
  }
}

// Routes

// Landing page
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>InstaScrape API</title>
        <style>
          body { font-family: monospace; background: #000; color: #00ff41; padding: 20px; }
          .container { max-width: 800px; margin: 0 auto; }
          .price { background: #001100; padding: 10px; margin: 10px 0; border: 1px solid #00ff41; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 InstaScrape API</h1>
          <p>Instant web scraping API - Get any website data in seconds!</p>
          
          <h2>📋 Pricing</h2>
          <div class="price">
            <strong>Basic Scrape - €5</strong><br>
            Extract title, description, headers, basic links
          </div>
          <div class="price">
            <strong>Premium Scrape - €20</strong><br>
            Custom selectors, full HTML, text extraction
          </div>
          <div class="price">
            <strong>Custom Scrape - €50</strong><br>
            Advanced options, wait conditions, complex data
          </div>
          
          <h2>🔧 API Documentation</h2>
          <pre>
POST /scrape
{
  "url": "https://example.com",
  "paymentId": "pi_xxx...",
  "tier": "basic|premium|custom",
  "options": {
    "selector": "h1, p",
    "type": "text|html",
    "waitFor": ".content"
  }
}
          </pre>
          
          <h2>💳 How to Pay</h2>
          <p>1. Create payment intent via Stripe</p>
          <p>2. Use payment ID in API call</p>
          <p>3. Get instant results!</p>
          
          <h2>⚖️ Legal Notice</h2>
          <p>Users must respect target website's robots.txt and Terms of Service.</p>
        </div>
      </body>
    </html>
  `);
});

// Main scraping endpoint
app.post('/scrape', async (req, res) => {
  const { url, paymentId, tier = 'basic', options = {} } = req.body;
  
  // Validate input
  if (!url || !paymentId) {
    return res.status(400).json({
      error: 'Missing required fields: url, paymentId'
    });
  }
  
  if (!isValidUrl(url)) {
    return res.status(400).json({
      error: 'Invalid or blacklisted URL'
    });
  }
  
  // Verify payment
  const paymentValid = await verifyPayment(paymentId);
  if (!paymentValid) {
    return res.status(402).json({
      error: 'Payment verification failed'
    });
  }
  
  // Perform scraping
  console.log(`Scraping ${url} for payment ${paymentId}`);
  const result = await scrapeWebsite(url, options);
  
  if (result.success) {
    res.json({
      success: true,
      url: url,
      data: result.data,
      scrapedAt: new Date().toISOString()
    });
  } else {
    res.status(500).json({
      error: 'Scraping failed',
      details: result.error
    });
  }
});

// Create payment intent
app.post('/create-payment', async (req, res) => {
  const { tier = 'basic' } = req.body;
  
  if (!PRICING[tier]) {
    return res.status(400).json({ error: 'Invalid pricing tier' });
  }
  
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: PRICING[tier],
      currency: 'eur',
      metadata: { tier }
    });
    
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentId: paymentIntent.id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 InstaScrape API running on port ${PORT}`);
}); 