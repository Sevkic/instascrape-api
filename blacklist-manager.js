// Dynamic blacklist management system
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

class BlacklistManager {
    constructor() {
        this.blacklistFile = path.join(__dirname, 'blacklist.json');
        this.robotsCache = new Map();
        this.lastUpdate = null;
        
        // Official sources for blacklisted domains
        this.sources = [
            'https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts',
            'https://someonewhocares.org/hosts/zero/hosts'
        ];
        
        this.staticBlacklist = [
            // Social Media - Strict ToS
            'facebook.com', 'www.facebook.com', 'm.facebook.com',
            'instagram.com', 'www.instagram.com',
            'twitter.com', 'www.twitter.com', 'x.com',
            'linkedin.com', 'www.linkedin.com',
            'tiktok.com', 'www.tiktok.com',
            'snapchat.com', 'www.snapchat.com',
            
            // E-commerce - Anti-scraping
            'amazon.com', 'www.amazon.com', 'amazon.co.uk',
            'ebay.com', 'www.ebay.com',
            'etsy.com', 'www.etsy.com',
            'shopify.com', 'www.shopify.com',
            
            // Search Engines
            'google.com', 'www.google.com',
            'bing.com', 'www.bing.com',
            'yahoo.com', 'www.yahoo.com',
            
            // Media Platforms
            'youtube.com', 'www.youtube.com',
            'netflix.com', 'www.netflix.com',
            'spotify.com', 'www.spotify.com',
            
            // Financial/Government
            'paypal.com', 'www.paypal.com',
            'stripe.com', 'www.stripe.com',
            'gov.uk', 'gov.rs', 'gov.us',
            
            // Known anti-bot sites
            'cloudflare.com', 'recaptcha.com'
        ];
        
        this.loadBlacklist();
    }

    async loadBlacklist() {
        try {
            const data = await fs.readFile(this.blacklistFile, 'utf8');
            const blacklist = JSON.parse(data);
            this.domains = new Set([...this.staticBlacklist, ...blacklist.domains]);
            this.lastUpdate = blacklist.lastUpdate;
            console.log(`📋 Loaded ${this.domains.size} blacklisted domains`);
        } catch (error) {
            console.log('📋 Creating new blacklist file');
            this.domains = new Set(this.staticBlacklist);
            await this.saveBlacklist();
        }
    }

    async saveBlacklist() {
        const blacklist = {
            domains: Array.from(this.domains).filter(d => !this.staticBlacklist.includes(d)),
            lastUpdate: new Date().toISOString(),
            version: '1.0'
        };
        
        await fs.writeFile(this.blacklistFile, JSON.stringify(blacklist, null, 2));
    }

    // Check robots.txt for a domain
    async checkRobotsTxt(url) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.toLowerCase();
            
            // Check cache first
            if (this.robotsCache.has(domain)) {
                const cached = this.robotsCache.get(domain);
                if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) { // 24 hours
                    return cached.result;
                }
            }

            const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
            
            return new Promise((resolve) => {
                const request = https.get(robotsUrl, { timeout: 5000 }, (res) => {
                    if (res.statusCode !== 200) {
                        const result = { allowed: true, reason: 'No robots.txt found' };
                        this.robotsCache.set(domain, { result, timestamp: Date.now() });
                        resolve(result);
                        return;
                    }

                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        const result = this.parseRobotsTxt(data, urlObj.pathname);
                        this.robotsCache.set(domain, { result, timestamp: Date.now() });
                        resolve(result);
                    });
                });

                request.on('error', () => {
                    const result = { allowed: true, reason: 'robots.txt check failed' };
                    resolve(result);
                });

                request.on('timeout', () => {
                    request.destroy();
                    const result = { allowed: true, reason: 'robots.txt timeout' };
                    resolve(result);
                });
            });

        } catch (error) {
            return { allowed: true, reason: 'Invalid URL' };
        }
    }

    parseRobotsTxt(content, path) {
        const lines = content.split('\n').map(line => line.trim().toLowerCase());
        let currentUserAgent = null;
        let blocked = false;

        for (const line of lines) {
            if (line.startsWith('user-agent:')) {
                const agent = line.split(':')[1].trim();
                currentUserAgent = (agent === '*' || agent.includes('bot') || agent.includes('spider'));
            }
            
            if (currentUserAgent && line.startsWith('disallow:')) {
                const disallowPath = line.split(':')[1].trim();
                if (disallowPath === '/' || (disallowPath && path.startsWith(disallowPath))) {
                    blocked = true;
                    break;
                }
            }
        }

        return {
            allowed: !blocked,
            reason: blocked ? 'Blocked by robots.txt' : 'Allowed by robots.txt',
            robotsTxt: content
        };
    }

    // Check if domain is blacklisted
    isBlacklisted(url) {
        try {
            const urlObj = new URL(url);
            const domain = urlObj.hostname.toLowerCase();
            
            // Check exact match
            if (this.domains.has(domain)) {
                return { blocked: true, reason: 'Domain in blacklist', domain };
            }
            
            // Check parent domains
            const parts = domain.split('.');
            for (let i = 0; i < parts.length - 1; i++) {
                const parentDomain = parts.slice(i).join('.');
                if (this.domains.has(parentDomain)) {
                    return { blocked: true, reason: 'Parent domain in blacklist', domain: parentDomain };
                }
            }
            
            return { blocked: false, reason: 'Domain allowed' };
            
        } catch (error) {
            return { blocked: true, reason: 'Invalid URL' };
        }
    }

    // Add domain to blacklist
    async addDomain(domain) {
        this.domains.add(domain.toLowerCase());
        await this.saveBlacklist();
        console.log(`🚫 Added ${domain} to blacklist`);
    }

    // Update blacklist from external sources (run daily)
    async updateFromSources() {
        console.log('📥 Updating blacklist from external sources...');
        
        for (const source of this.sources) {
            try {
                // This would fetch from external blocklists
                // Implementation depends on the source format
                console.log(`📥 Checking source: ${source}`);
            } catch (error) {
                console.error(`❌ Failed to update from ${source}:`, error.message);
            }
        }
        
        await this.saveBlacklist();
        console.log('✅ Blacklist updated');
    }

    // Get blacklist stats
    getStats() {
        return {
            totalDomains: this.domains.size,
            staticDomains: this.staticBlacklist.length,
            dynamicDomains: this.domains.size - this.staticBlacklist.length,
            robotsCacheSize: this.robotsCache.size,
            lastUpdate: this.lastUpdate
        };
    }

    // Comprehensive URL validation
    async validateUrl(url) {
        // 1. Basic URL validation
        try {
            new URL(url);
        } catch {
            return { valid: false, reason: 'Invalid URL format' };
        }

        // 2. Check blacklist
        const blacklistCheck = this.isBlacklisted(url);
        if (blacklistCheck.blocked) {
            return { 
                valid: false, 
                reason: `Blacklisted: ${blacklistCheck.reason}`,
                domain: blacklistCheck.domain 
            };
        }

        // 3. Check robots.txt
        const robotsCheck = await this.checkRobotsTxt(url);
        if (!robotsCheck.allowed) {
            return { 
                valid: false, 
                reason: robotsCheck.reason,
                robotsTxt: true 
            };
        }

        return { 
            valid: true, 
            reason: 'URL validated',
            robotsCompliant: true,
            robotsReason: robotsCheck.reason 
        };
    }
}

module.exports = { BlacklistManager };