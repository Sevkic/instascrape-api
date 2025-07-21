// Complete Terms of Service and Legal Protection
const TERMS_OF_SERVICE = {
    version: "1.0",
    effectiveDate: "2024-01-01",
    lastModified: "2024-01-01",
    
    // Main legal protection text
    terms: `
TERMS OF SERVICE AND USER AGREEMENT
=====================================

IMPORTANT: READ CAREFULLY BEFORE USING THIS SERVICE

By using InstaScrape API ("the Service"), you ("User") agree to be bound by these Terms of Service.

1. ACCEPTANCE OF TERMS
----------------------
By accessing or using this Service, you acknowledge that you have read, understood, and agree to be bound by these terms. If you do not agree, you must not use this Service.

2. NATURE OF SERVICE
-------------------
InstaScrape provides neutral technical infrastructure for data extraction. We are a tool provider only and do NOT:
- Monitor, control, or review user activity
- Endorse any particular use of scraped data
- Guarantee access to any specific website
- Take responsibility for scraped content accuracy

3. USER RESPONSIBILITIES (CRITICAL)
----------------------------------
You are SOLELY RESPONSIBLE for:

✓ Ensuring your use complies with ALL applicable laws in your jurisdiction
✓ Respecting target websites' Terms of Service and robots.txt files  
✓ Obtaining necessary permissions before scraping any website
✓ Complying with copyright, privacy, and data protection laws (GDPR, CCPA, etc.)
✓ Not accessing sites that prohibit automated access
✓ Using reasonable request rates (max 1 request/second per domain)
✓ The legality, accuracy, and appropriateness of all scraped data

4. PROHIBITED USES
-----------------
You MUST NOT use this Service to:

❌ Scrape websites that explicitly prohibit scraping in robots.txt
❌ Access password-protected, paywall, or login-required content
❌ Engage in spam, phishing, DDoS, or any illegal activities
❌ Scrape personal data without proper legal basis
❌ Violate any website's Terms of Service
❌ Circumvent rate limiting or anti-bot measures
❌ Access government, financial, or sensitive institutional websites
❌ Scrape copyrighted content for commercial redistribution

5. AUTOMATIC BLOCKING
--------------------
Our Service automatically blocks access to certain domains including but not limited to:
- Social media platforms (Facebook, Instagram, Twitter, LinkedIn, TikTok)
- E-commerce sites with anti-scraping measures (Amazon, eBay)
- Search engines (Google, Bing, Yahoo)
- Video platforms (YouTube, Netflix, Spotify)
- Financial services (PayPal, Stripe, banking sites)
- Government and institutional websites

6. DISCLAIMER OF LIABILITY
-------------------------
TO THE MAXIMUM EXTENT PERMITTED BY LAW:

- This Service is provided "AS IS" without warranties of any kind
- We disclaim all liability for User's use of scraped data
- We are not liable for any damages arising from Service use
- Users assume all risks associated with web scraping activities
- We do not guarantee Service availability, accuracy, or functionality

7. INDEMNIFICATION
-----------------
You agree to indemnify and hold harmless InstaScrape, its operators, and affiliates from any claims, damages, or legal actions arising from your use of this Service.

8. DATA AND PRIVACY
------------------
- We may log API requests for security and abuse prevention
- We do not store or retain scraped content
- Users are responsible for handling scraped data in compliance with privacy laws

9. TERMINATION
-------------
We reserve the right to terminate access for users who:
- Violate these Terms of Service
- Attempt to scrape blacklisted domains
- Engage in abusive or illegal behavior
- Exceed reasonable usage limits

10. GOVERNING LAW
----------------
These Terms are governed by [YOUR JURISDICTION] law. Any disputes will be resolved in [YOUR JURISDICTION] courts.

11. CHANGES TO TERMS
-------------------
We may modify these Terms at any time. Continued use constitutes acceptance of modified Terms.

12. CONTACT
----------
For questions about these Terms: [YOUR EMAIL]

BY USING THIS SERVICE, YOU ACKNOWLEDGE THAT YOU HAVE READ AND UNDERSTOOD THESE TERMS AND AGREE TO BE LEGALLY BOUND BY THEM.
`,

    // Privacy Policy
    privacyPolicy: `
PRIVACY POLICY
==============

Information We Collect:
- API request logs (IP address, timestamp, target URL)
- Usage statistics for service improvement
- Error logs for debugging purposes

Information We Do NOT Collect:
- Scraped content (not stored or retained)
- Personal information beyond basic usage logs
- User browsing history or behavior outside our Service

Data Usage:
- Logs used only for security, abuse prevention, and service improvement
- No sharing of user data with third parties
- Automatic deletion of logs after 30 days

User Rights:
- Request deletion of your data
- Access your usage logs
- Opt-out of usage statistics collection

Contact: [YOUR EMAIL] for privacy requests
`,

    // Risk Warning
    riskWarning: `
⚠️  LEGAL RISK WARNING ⚠️
========================

WEB SCRAPING CARRIES INHERENT LEGAL RISKS:

🚨 Website Terms of Service may prohibit scraping
🚨 Copyright laws may protect scraped content  
🚨 Privacy laws may restrict personal data collection
🚨 Some jurisdictions have specific anti-scraping laws
🚨 Companies may pursue legal action against scrapers

YOU ACCEPT ALL RISKS by using this Service.

WE STRONGLY RECOMMEND:
✅ Consulting with legal counsel before scraping
✅ Reading target website Terms of Service
✅ Obtaining explicit permission when possible
✅ Limiting scraping to publicly available data
✅ Respecting robots.txt and rate limits

REMEMBER: "Publicly accessible" ≠ "Legally scrapable"
`,

    // Specific legal clauses for extra protection
    legalClauses: {
        neutralInfrastructure: "InstaScrape provides neutral technical infrastructure only. We do not control, monitor, endorse, or take responsibility for how users employ our tools.",
        
        noLegalAdvice: "Nothing in this Service constitutes legal advice. Users must obtain independent legal counsel regarding web scraping in their jurisdiction.",
        
        userSoleResponsibility: "User is solely and exclusively responsible for ensuring their use complies with all applicable laws, regulations, and third-party terms of service.",
        
        noGuarantees: "We make no representations or warranties about the legality of accessing any particular website or the accuracy of scraped data.",
        
        automaticBlocking: "We implement technical measures to block access to certain domains, but users remain responsible for legal compliance regardless of our blocking mechanisms."
    }
};

// Legal status codes for different scenarios
const LEGAL_STATUS = {
    APPROVED: 'APPROVED',
    BLOCKED_BLACKLIST: 'BLOCKED_BLACKLIST',
    BLOCKED_ROBOTS: 'BLOCKED_ROBOTS',
    BLOCKED_MANUAL: 'BLOCKED_MANUAL',
    REQUIRES_REVIEW: 'REQUIRES_REVIEW'
};

// Generate legal compliance report
function generateComplianceReport(url, validationResult) {
    const report = {
        url: url,
        timestamp: new Date().toISOString(),
        status: validationResult.valid ? LEGAL_STATUS.APPROVED : LEGAL_STATUS.BLOCKED_BLACKLIST,
        checks: {
            urlFormat: true,
            blacklistCheck: !validationResult.reason?.includes('Blacklisted'),
            robotsCheck: validationResult.robotsCompliant || false,
            legalCompliance: validationResult.valid
        },
        reasons: [validationResult.reason],
        recommendations: []
    };

    // Add specific recommendations
    if (!report.checks.blacklistCheck) {
        report.recommendations.push("Domain is in our security blacklist due to strict Terms of Service");
    }
    
    if (!report.checks.robotsCheck) {
        report.recommendations.push("Check robots.txt file before scraping");
        report.recommendations.push("Consider contacting website owner for permission");
    }

    report.recommendations.push("Ensure compliance with website Terms of Service");
    report.recommendations.push("Respect rate limits (max 1 request/second)");
    report.recommendations.push("Only scrape publicly available data");

    return report;
}

module.exports = { 
    TERMS_OF_SERVICE, 
    LEGAL_STATUS, 
    generateComplianceReport 
};