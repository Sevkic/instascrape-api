// Advanced abuse protection and monitoring system
const fs = require('fs').promises;
const path = require('path');

class AbuseProtectionSystem {
    constructor() {
        this.logFile = path.join(__dirname, 'access.log');
        this.abuseFile = path.join(__dirname, 'abuse-reports.json');
        
        // Rate limiting storage (in production use Redis)
        this.ipTracker = new Map();
        this.domainTracker = new Map();
        this.suspiciousIPs = new Set();
        this.bannedIPs = new Set();
        
        // Abuse detection thresholds
        this.limits = {
            maxRequestsPerIP: 100,        // per hour
            maxRequestsPerDomain: 60,     // per hour
            maxFailedAttempts: 10,        // per hour
            maxBlacklistAttempts: 3,      // instant ban
            windowMs: 60 * 60 * 1000,     // 1 hour
            
            // Daily limits
            dailyMaxRequests: 1000,
            dailyMaxDomains: 100
        };
        
        // Clean old entries every 5 minutes
        setInterval(() => this.cleanOldEntries(), 5 * 60 * 1000);
    }

    // Log all API requests with detailed info
    async logRequest(req, result = null) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            method: req.method,
            endpoint: req.path,
            targetUrl: req.body.url,
            targetDomain: this.extractDomain(req.body.url),
            success: result?.success || false,
            error: result?.error,
            processingTime: result?.processingTime,
            dataSize: result?.dataSize,
            accessToken: req.body.accessToken ? 'present' : 'missing',
            headers: {
                'x-forwarded-for': req.get('X-Forwarded-For'),
                'x-real-ip': req.get('X-Real-IP'),
                'referer': req.get('Referer'),
                'origin': req.get('Origin')
            }
        };

        try {
            await fs.appendFile(this.logFile, JSON.stringify(logEntry) + '\n');
        } catch (error) {
            console.error('❌ Failed to write access log:', error);
        }

        return logEntry;
    }

    // Rate limiting check
    checkRateLimit(ip, domain = null) {
        const now = Date.now();
        const ipKey = `ip_${ip}`;
        const domainKey = domain ? `domain_${domain}` : null;

        // Check IP rate limit
        if (!this.ipTracker.has(ipKey)) {
            this.ipTracker.set(ipKey, { requests: [], failures: [] });
        }

        const ipData = this.ipTracker.get(ipKey);
        
        // Remove old entries
        ipData.requests = ipData.requests.filter(time => now - time < this.limits.windowMs);
        ipData.failures = ipData.failures.filter(time => now - time < this.limits.windowMs);

        // Check limits
        if (ipData.requests.length >= this.limits.maxRequestsPerIP) {
            this.flagSuspiciousIP(ip, 'Rate limit exceeded');
            return { 
                allowed: false, 
                reason: `Rate limit exceeded: ${ipData.requests.length}/${this.limits.maxRequestsPerIP} requests per hour`,
                resetTime: new Date(Math.min(...ipData.requests) + this.limits.windowMs).toISOString()
            };
        }

        if (ipData.failures.length >= this.limits.maxFailedAttempts) {
            this.bannedIPs.add(ip);
            return { 
                allowed: false, 
                reason: `Too many failed attempts: ${ipData.failures.length}/${this.limits.maxFailedAttempts}`,
                banned: true
            };
        }

        // Check domain rate limit if provided
        if (domain && domainKey) {
            if (!this.domainTracker.has(domainKey)) {
                this.domainTracker.set(domainKey, { requests: [] });
            }

            const domainData = this.domainTracker.get(domainKey);
            domainData.requests = domainData.requests.filter(time => now - time < this.limits.windowMs);

            if (domainData.requests.length >= this.limits.maxRequestsPerDomain) {
                return { 
                    allowed: false, 
                    reason: `Domain rate limit exceeded: ${domainData.requests.length}/${this.limits.maxRequestsPerDomain} requests per hour for ${domain}` 
                };
            }
        }

        return { allowed: true, remaining: this.limits.maxRequestsPerIP - ipData.requests.length };
    }

    // Record successful request
    recordRequest(ip, domain = null) {
        const now = Date.now();
        const ipKey = `ip_${ip}`;
        
        if (!this.ipTracker.has(ipKey)) {
            this.ipTracker.set(ipKey, { requests: [], failures: [] });
        }
        
        this.ipTracker.get(ipKey).requests.push(now);

        if (domain) {
            const domainKey = `domain_${domain}`;
            if (!this.domainTracker.has(domainKey)) {
                this.domainTracker.set(domainKey, { requests: [] });
            }
            this.domainTracker.get(domainKey).requests.push(now);
        }
    }

    // Record failed request
    recordFailure(ip, reason) {
        const now = Date.now();
        const ipKey = `ip_${ip}`;
        
        if (!this.ipTracker.has(ipKey)) {
            this.ipTracker.set(ipKey, { requests: [], failures: [] });
        }
        
        this.ipTracker.get(ipKey).failures.push(now);
        
        // Auto-ban for blacklist attempts
        if (reason.includes('blacklist') || reason.includes('Blacklisted')) {
            const failures = this.ipTracker.get(ipKey).failures.filter(time => now - time < this.limits.windowMs);
            if (failures.length >= this.limits.maxBlacklistAttempts) {
                this.bannedIPs.add(ip);
                this.reportAbuse(ip, 'Multiple blacklist bypass attempts', { reason, attempts: failures.length });
            }
        }
    }

    // Flag suspicious IP
    flagSuspiciousIP(ip, reason) {
        this.suspiciousIPs.add(ip);
        console.log(`🚨 Flagged suspicious IP: ${ip} - ${reason}`);
        this.reportAbuse(ip, reason);
    }

    // Check if IP is banned or suspicious
    checkIPStatus(ip) {
        if (this.bannedIPs.has(ip)) {
            return { status: 'banned', reason: 'IP banned due to abuse' };
        }
        
        if (this.suspiciousIPs.has(ip)) {
            return { status: 'suspicious', reason: 'IP flagged for suspicious activity' };
        }
        
        return { status: 'clean', reason: 'No issues detected' };
    }

    // Report abuse incident
    async reportAbuse(ip, reason, metadata = {}) {
        const report = {
            timestamp: new Date().toISOString(),
            ip: ip,
            reason: reason,
            metadata: metadata,
            severity: this.calculateSeverity(reason),
            id: `abuse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        try {
            let reports = [];
            try {
                const data = await fs.readFile(this.abuseFile, 'utf8');
                reports = JSON.parse(data);
            } catch {
                // File doesn't exist yet
            }

            reports.push(report);
            
            // Keep only last 1000 reports
            if (reports.length > 1000) {
                reports = reports.slice(-1000);
            }

            await fs.writeFile(this.abuseFile, JSON.stringify(reports, null, 2));
            console.log(`📝 Abuse report filed: ${report.id}`);
        } catch (error) {
            console.error('❌ Failed to write abuse report:', error);
        }

        return report;
    }

    // Calculate abuse severity
    calculateSeverity(reason) {
        const highSeverityKeywords = ['blacklist', 'ban', 'illegal', 'attack', 'flood'];
        const mediumSeverityKeywords = ['rate limit', 'suspicious', 'failure'];
        
        const reasonLower = reason.toLowerCase();
        
        if (highSeverityKeywords.some(keyword => reasonLower.includes(keyword))) {
            return 'HIGH';
        }
        
        if (mediumSeverityKeywords.some(keyword => reasonLower.includes(keyword))) {
            return 'MEDIUM';
        }
        
        return 'LOW';
    }

    // Extract domain from URL
    extractDomain(url) {
        try {
            return new URL(url).hostname.toLowerCase();
        } catch {
            return 'invalid-url';
        }
    }

    // Clean old tracking entries
    cleanOldEntries() {
        const now = Date.now();
        const cutoff = now - this.limits.windowMs;
        let cleaned = 0;

        // Clean IP tracker
        for (const [key, data] of this.ipTracker) {
            data.requests = data.requests.filter(time => time > cutoff);
            data.failures = data.failures.filter(time => time > cutoff);
            
            if (data.requests.length === 0 && data.failures.length === 0) {
                this.ipTracker.delete(key);
                cleaned++;
            }
        }

        // Clean domain tracker
        for (const [key, data] of this.domainTracker) {
            data.requests = data.requests.filter(time => time > cutoff);
            
            if (data.requests.length === 0) {
                this.domainTracker.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} old tracking entries`);
        }
    }

    // Get abuse protection stats
    getStats() {
        return {
            trackedIPs: this.ipTracker.size,
            trackedDomains: this.domainTracker.size,
            suspiciousIPs: this.suspiciousIPs.size,
            bannedIPs: this.bannedIPs.size,
            limits: this.limits
        };
    }

    // Manual ban/unban functions
    banIP(ip, reason) {
        this.bannedIPs.add(ip);
        this.reportAbuse(ip, `Manual ban: ${reason}`, { manual: true });
        console.log(`🚫 Manually banned IP: ${ip}`);
    }

    unbanIP(ip) {
        this.bannedIPs.delete(ip);
        this.suspiciousIPs.delete(ip);
        console.log(`✅ Unbanned IP: ${ip}`);
    }

    // Get recent abuse reports
    async getRecentAbuse(limit = 50) {
        try {
            const data = await fs.readFile(this.abuseFile, 'utf8');
            const reports = JSON.parse(data);
            return reports.slice(-limit).reverse(); // Most recent first
        } catch {
            return [];
        }
    }
}

module.exports = { AbuseProtectionSystem };