// Credit management system without user accounts
const crypto = require('crypto');

class CreditManager {
    constructor() {
        // In-memory storage (for production, use Redis/database)
        this.tokens = new Map();
        this.credits = {
            basic: 1,    // 1 credit per basic scrape
            premium: 5,  // 5 credits per premium scrape  
            custom: 10   // 10 credits per custom scrape
        };
    }

    // Generate access token after payment
    generateAccessToken(paymentData) {
        const tokenId = crypto.randomBytes(16).toString('hex');
        const token = {
            id: tokenId,
            tier: paymentData.tier,
            credits: this.getCreditsForTier(paymentData.tier),
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
            paymentId: paymentData.paymentId,
            usedCredits: 0
        };

        this.tokens.set(tokenId, token);
        
        return {
            accessToken: tokenId,
            credits: token.credits,
            tier: token.tier,
            expiresAt: token.expiresAt
        };
    }

    // Get credits for tier
    getCreditsForTier(tier) {
        const creditAmounts = {
            basic: 10,     // €5 = 10 basic scrapes (€0.50 each)
            premium: 20,   // €20 = 20 premium scrapes (€1.00 each)
            custom: 50     // €50 = 50 custom scrapes (€1.00 each)
        };
        return creditAmounts[tier] || 1;
    }

    // Validate and consume credits
    validateAndConsumeCredit(accessToken, requestedTier) {
        const token = this.tokens.get(accessToken);
        
        if (!token) {
            return { valid: false, error: 'Invalid access token' };
        }

        if (new Date() > new Date(token.expiresAt)) {
            this.tokens.delete(accessToken);
            return { valid: false, error: 'Access token expired' };
        }

        const creditsNeeded = this.credits[requestedTier] || 1;
        const availableCredits = token.credits - token.usedCredits;

        if (availableCredits < creditsNeeded) {
            return { 
                valid: false, 
                error: 'Insufficient credits',
                available: availableCredits,
                needed: creditsNeeded
            };
        }

        // Consume credits
        token.usedCredits += creditsNeeded;
        token.lastUsed = new Date().toISOString();

        return {
            valid: true,
            remainingCredits: token.credits - token.usedCredits,
            tier: token.tier
        };
    }

    // Get token info
    getTokenInfo(accessToken) {
        const token = this.tokens.get(accessToken);
        if (!token) {
            return null;
        }

        return {
            tier: token.tier,
            totalCredits: token.credits,
            usedCredits: token.usedCredits,
            remainingCredits: token.credits - token.usedCredits,
            expiresAt: token.expiresAt,
            createdAt: token.createdAt
        };
    }

    // Clean expired tokens (run periodically)
    cleanExpiredTokens() {
        const now = new Date();
        for (const [tokenId, token] of this.tokens) {
            if (new Date(token.expiresAt) < now) {
                this.tokens.delete(tokenId);
            }
        }
    }

    // Get stats
    getStats() {
        const activeTokens = Array.from(this.tokens.values());
        return {
            totalTokens: activeTokens.length,
            totalCreditsIssued: activeTokens.reduce((sum, t) => sum + t.credits, 0),
            totalCreditsUsed: activeTokens.reduce((sum, t) => sum + t.usedCredits, 0),
            tiers: {
                basic: activeTokens.filter(t => t.tier === 'basic').length,
                premium: activeTokens.filter(t => t.tier === 'premium').length,
                custom: activeTokens.filter(t => t.tier === 'custom').length
            }
        };
    }
}

// Session-based alternative (simpler but less flexible)
class SessionManager {
    constructor() {
        this.sessions = new Map();
    }

    createSession(paymentData) {
        const sessionId = crypto.randomBytes(16).toString('hex');
        const sessionDuration = {
            basic: 1 * 60 * 60 * 1000,    // 1 hour for basic
            premium: 24 * 60 * 60 * 1000,  // 24 hours for premium
            custom: 7 * 24 * 60 * 60 * 1000 // 7 days for custom
        };

        const session = {
            id: sessionId,
            tier: paymentData.tier,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + sessionDuration[paymentData.tier]).toISOString(),
            paymentId: paymentData.paymentId,
            requestCount: 0
        };

        this.sessions.set(sessionId, session);
        return {
            sessionToken: sessionId,
            tier: session.tier,
            expiresAt: session.expiresAt
        };
    }

    validateSession(sessionToken) {
        const session = this.sessions.get(sessionToken);
        
        if (!session) {
            return { valid: false, error: 'Invalid session token' };
        }

        if (new Date() > new Date(session.expiresAt)) {
            this.sessions.delete(sessionToken);
            return { valid: false, error: 'Session expired' };
        }

        session.requestCount++;
        session.lastUsed = new Date().toISOString();

        return {
            valid: true,
            tier: session.tier,
            requestCount: session.requestCount,
            expiresAt: session.expiresAt
        };
    }
}

module.exports = { CreditManager, SessionManager };