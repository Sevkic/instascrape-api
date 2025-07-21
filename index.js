const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
// LemonSqueezy integration (replace Stripe)
const { MockPaymentSystem } = require('./public/lemonsqueezy');
const { CreditManager } = require('./credit-system');
const { EnhancedScraper } = require('./enhanced-scraper');
const { BlacklistManager } = require('./blacklist-manager');
const { TERMS_OF_SERVICE, generateComplianceReport } = require('./legal-tos');
const { AbuseProtectionSystem } = require('./abuse-protection');

const mockPayments = new MockPaymentSystem();
const creditManager = new CreditManager();
const enhancedScraper = new EnhancedScraper();
const blacklistManager = new BlacklistManager();
const abuseProtection = new AbuseProtectionSystem();
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Rate Limiting
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline styles for frontend
}));
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static('public'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Restricted domains - sites with strict ToS or anti-scraping measures
const RESTRICTED_DOMAINS = [
  'facebook.com',    // Strict anti-scraping, login required
  'instagram.com',   // API-only access, strong anti-bot
  'twitter.com',     // Rate limits, API required
  'linkedin.com',    // Professional network, privacy concerns  
  'google.com',      // Search results, constantly changing
  'amazon.com',      // Anti-scraping measures, dynamic content
  'youtube.com',     // API required, video content
  'tiktok.com',      // Mobile-first, heavily protected
  'pinterest.com',   // Image-heavy, requires auth
  'reddit.com'       // Rate limits, community guidelines
];

// Legal compliance requirements
const COMPLIANCE_RULES = {
  respectRobotsTxt: true,
  maxRequestRate: 1, // 1 request per second
  requiresUserConsent: true,
  publicDataOnly: true
};

// Pricing tiers
const PRICING = {
  basic: 500, // €5.00 in cents
  premium: 2000, // €20.00 in cents
  custom: 5000 // €50.00 in cents
};

// Enhanced URL validation using BlacklistManager
async function validateUrlEnhanced(url) {
  try {
    return await blacklistManager.validateUrl(url);
  } catch (error) {
    return { valid: false, reason: 'Validation error: ' + error.message };
  }
}

// Legacy validation for backward compatibility
function isValidUrl(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    
    // Check if domain is restricted
    const isRestricted = RESTRICTED_DOMAINS.some(restricted => 
      domain.includes(restricted) || domain === restricted
    );
    
    return !isRestricted;
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

// Payment verification (LemonSqueezy/Mock)
async function verifyPayment(paymentId) {
  try {
    // For demo: use mock payment system
    return mockPayments.verifyPayment(paymentId);
  } catch (error) {
    return false;
  }
}

// Routes

// API root - redirect to frontend
app.get('/api', (req, res) => {
  res.json({
    name: 'InstaScrape API',
    version: '1.0.0',
    endpoints: {
      scrape: 'POST /api/scrape',
      payment: 'POST /api/create-payment',
      health: 'GET /api/health'
    }
  });
});

// Enhanced scraping endpoint with credit system
app.post('/scrape', async (req, res) => {
  const { url, accessToken, tier = 'basic', options = {} } = req.body;
  
  // Validate input
  if (!url || !accessToken) {
    return res.status(400).json({
      error: 'Missing required fields: url, accessToken'
    });
  }
  
  if (!isValidUrl(url)) {
    return res.status(400).json({
      error: 'Invalid URL or restricted domain',
      details: 'This domain is restricted due to Terms of Service or anti-scraping measures',
      restrictedDomains: RESTRICTED_DOMAINS
    });
  }
  
  // Validate and consume credits
  const creditCheck = creditManager.validateAndConsumeCredit(accessToken, tier);
  if (!creditCheck.valid) {
    return res.status(402).json({
      error: creditCheck.error,
      available: creditCheck.available,
      needed: creditCheck.needed
    });
  }
  
  // Perform enhanced scraping
  console.log(`Enhanced scraping ${url} with token ${accessToken} (${creditCheck.remainingCredits} credits left)`);
  
  try {
    const result = await enhancedScraper.scrapeEnhanced(url, options);
    
    if (result.success) {
      res.json({
        success: true,
        url: url,
        data: result.data,
        metadata: result.metadata,
        credits: {
          remaining: creditCheck.remainingCredits,
          tier: creditCheck.tier
        },
        scrapedAt: new Date().toISOString()
      });
    } else {
      // Refund credit on failure
      const token = creditManager.tokens.get(accessToken);
      if (token) {
        token.usedCredits -= creditManager.credits[tier] || 1;
      }
      
      res.status(500).json({
        error: 'Scraping failed',
        details: result.error,
        creditRefunded: true
      });
    }
  } catch (error) {
    // Refund credit on server error
    const token = creditManager.tokens.get(accessToken);
    if (token) {
      token.usedCredits -= creditManager.credits[tier] || 1;
    }
    
    res.status(500).json({
      error: 'Server error during scraping',
      details: error.message,
      creditRefunded: true
    });
  }
});

// Legacy endpoint for backward compatibility (paymentId)
app.post('/scrape-legacy', async (req, res) => {
  const { url, paymentId, tier = 'basic', options = {} } = req.body;
  
  // Validate input
  if (!url || !paymentId) {
    return res.status(400).json({
      error: 'Missing required fields: url, paymentId'
    });
  }
  
  if (!isValidUrl(url)) {
    return res.status(400).json({
      error: 'Invalid URL or restricted domain',
      details: 'This domain is restricted due to Terms of Service or anti-scraping measures',
      restrictedDomains: RESTRICTED_DOMAINS
    });
  }
  
  // Verify payment (old system)
  const paymentValid = await verifyPayment(paymentId);
  if (!paymentValid) {
    return res.status(402).json({
      error: 'Payment verification failed'
    });
  }
  
  // Perform basic scraping
  console.log(`Legacy scraping ${url} for payment ${paymentId}`);
  const result = await scrapeWebsite(url, options);
  
  if (result.success) {
    res.json({
      success: true,
      url: url,
      data: result.data,
      scrapedAt: new Date().toISOString(),
      note: 'Legacy endpoint - upgrade to token-based system for enhanced features'
    });
  } else {
    res.status(500).json({
      error: 'Scraping failed',
      details: result.error
    });
  }
});

// Create payment (LemonSqueezy/Mock) with credit system
app.post('/create-payment', async (req, res) => {
  const { tier = 'basic' } = req.body;
  
  if (!PRICING[tier]) {
    return res.status(400).json({ error: 'Invalid pricing tier' });
  }
  
  try {
    // For demo: use mock payment system
    const payment = mockPayments.createPayment(tier);
    
    // Generate access token after payment
    setTimeout(() => {
      const tokenData = creditManager.generateAccessToken({
        paymentId: payment.paymentId,
        tier: tier
      });
      console.log(`Access token generated: ${tokenData.accessToken} (${tokenData.credits} credits)`);
    }, 3000); // Simulate payment processing time
    
    res.json({
      paymentId: payment.paymentId,
      checkoutUrl: payment.checkoutUrl,
      amount: payment.amount,
      tier: tier,
      message: 'Payment processing... Access token will be generated upon completion.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get access token after payment
app.get('/access-token/:paymentId', (req, res) => {
  const { paymentId } = req.params;
  
  // Find token by payment ID
  const tokens = Array.from(creditManager.tokens.values());
  const token = tokens.find(t => t.paymentId === paymentId);
  
  if (!token) {
    return res.status(404).json({ error: 'Payment not found or still processing' });
  }
  
  res.json({
    accessToken: token.id,
    credits: token.credits - token.usedCredits,
    tier: token.tier,
    expiresAt: token.expiresAt
  });
});

// Terms of Service acceptance
app.post('/accept-terms', (req, res) => {
  const { accepted, userIP, userAgent, timestamp } = req.body;
  
  if (!accepted) {
    return res.status(400).json({ 
      error: 'Terms of Service must be accepted to use this API' 
    });
  }
  
  // Log acceptance (in production, store in database)
  const acceptanceRecord = {
    userIP: req.ip || userIP,
    userAgent: req.get('User-Agent') || userAgent,
    acceptedAt: new Date().toISOString(),
    timestamp: timestamp
  };
  
  console.log('ToS Acceptance:', acceptanceRecord);
  
  res.json({ 
    success: true, 
    message: 'Terms of Service accepted',
    acceptanceId: crypto.randomBytes(8).toString('hex')
  });
});

// Get Complete Terms of Service
app.get('/terms', (req, res) => {
  res.json({
    termsOfService: TERMS_OF_SERVICE,
    blacklistStats: blacklistManager.getStats(),
    legalNotice: "By using this API, you agree to our complete Terms of Service and acknowledge full legal responsibility for your use."
  });
});

// Get full legal document (HTML formatted)
app.get('/legal', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(TERMS_OF_SERVICE.terms);
});

// Privacy Policy endpoint
app.get('/privacy', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(TERMS_OF_SERVICE.privacyPolicy);
});

// Check credit balance
app.get('/credits/:accessToken', (req, res) => {
  const { accessToken } = req.params;
  const tokenInfo = creditManager.getTokenInfo(accessToken);
  
  if (!tokenInfo) {
    return res.status(404).json({ error: 'Invalid access token' });
  }
  
  res.json(tokenInfo);
});

// PROTECTED TEST endpoint with full legal compliance
app.post('/test-scrape', async (req, res) => {
  const startTime = Date.now();
  const clientIP = req.ip || req.connection.remoteAddress;
  
  try {
    // 1. Check if IP is banned or suspicious
    const ipStatus = abuseProtection.checkIPStatus(clientIP);
    if (ipStatus.status === 'banned') {
      return res.status(403).json({ 
        error: 'Access denied', 
        reason: ipStatus.reason,
        appeal: 'Contact support if you believe this is an error'
      });
    }

    // 2. Rate limiting check
    const { url, options = {} } = req.body;
    const domain = url ? abuseProtection.extractDomain(url) : null;
    const rateLimitResult = abuseProtection.checkRateLimit(clientIP, domain);
    
    if (!rateLimitResult.allowed) {
      abuseProtection.recordFailure(clientIP, 'Rate limit exceeded');
      return res.status(429).json({
        error: 'Rate limit exceeded',
        details: rateLimitResult.reason,
        resetTime: rateLimitResult.resetTime,
        limits: 'Max 100 requests per hour per IP'
      });
    }

    // 3. Validate URL input
    if (!url) {
      abuseProtection.recordFailure(clientIP, 'Missing URL');
      return res.status(400).json({ error: 'URL is required' });
    }

    // 4. Enhanced URL validation with blacklist and robots.txt
    console.log(`🔍 Validating URL: ${url} from IP: ${clientIP}`);
    const validation = await validateUrlEnhanced(url);
    
    if (!validation.valid) {
      abuseProtection.recordFailure(clientIP, validation.reason);
      
      // Generate legal compliance report
      const complianceReport = generateComplianceReport(url, validation);
      
      return res.status(400).json({
        error: 'URL validation failed',
        reason: validation.reason,
        legalCompliance: complianceReport,
        appeal: 'This URL is blocked for legal protection. See /legal for full terms.',
        documentation: '/terms'
      });
    }

    // 5. Log successful validation
    console.log(`✅ FREE TEST: Scraping ${url} from ${clientIP}`);
    abuseProtection.recordRequest(clientIP, domain);

    // 6. Perform enhanced scraping
    const result = await enhancedScraper.scrapeEnhanced(url, options);
    const processingTime = Date.now() - startTime;

    // 7. Log request with full details
    await abuseProtection.logRequest(req, {
      success: result.success,
      error: result.success ? null : result.error,
      processingTime: processingTime,
      dataSize: result.success ? JSON.stringify(result.data).length : 0
    });

    // 8. Send enhanced response with legal compliance info
    if (result.success) {
      const complianceReport = generateComplianceReport(url, validation);
      
      res.json({
        success: true,
        url: url,
        data: result.data,
        metadata: {
          ...result.metadata,
          processingTime: processingTime,
          legalCompliance: complianceReport
        },
        legalNotice: 'User is solely responsible for compliance with target website ToS and applicable laws',
        scrapedAt: new Date().toISOString(),
        mode: 'FREE_TEST'
      });
    } else {
      abuseProtection.recordFailure(clientIP, 'Scraping failed');
      res.status(500).json({
        error: 'Scraping failed',
        details: result.error,
        url: url,
        legalNotice: 'Scraping failure may indicate target website restrictions'
      });
    }

  } catch (error) {
    abuseProtection.recordFailure(clientIP, 'Server error');
    await abuseProtection.logRequest(req, {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime
    });

    res.status(500).json({
      error: 'Internal server error',
      details: 'Please try again later',
      requestId: `req_${Date.now()}`
    });
  }
});

// Admin stats endpoint with comprehensive monitoring
app.get('/admin/stats', (req, res) => {
  const stats = {
    credits: creditManager.getStats(),
    abuse: abuseProtection.getStats(),
    blacklist: blacklistManager.getStats(),
    system: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    }
  };
  
  res.json(stats);
});

// Admin abuse reports
app.get('/admin/abuse', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const reports = await abuseProtection.getRecentAbuse(limit);
  
  res.json({
    reports,
    summary: {
      total: reports.length,
      highSeverity: reports.filter(r => r.severity === 'HIGH').length,
      mediumSeverity: reports.filter(r => r.severity === 'MEDIUM').length,
      lowSeverity: reports.filter(r => r.severity === 'LOW').length
    }
  });
});

// Admin manual IP management
app.post('/admin/ban-ip', (req, res) => {
  const { ip, reason } = req.body;
  if (!ip || !reason) {
    return res.status(400).json({ error: 'IP and reason required' });
  }
  
  abuseProtection.banIP(ip, reason);
  res.json({ success: true, message: `Banned IP: ${ip}` });
});

app.post('/admin/unban-ip', (req, res) => {
  const { ip } = req.body;
  if (!ip) {
    return res.status(400).json({ error: 'IP required' });
  }
  
  abuseProtection.unbanIP(ip);
  res.json({ success: true, message: `Unbanned IP: ${ip}` });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: ['enhanced-scraping', 'credit-system', 'robots-txt-compliance']
  });
});

app.listen(PORT, () => {
  console.log(`🚀 InstaScrape API running on port ${PORT}`);
}); 