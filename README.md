# 🚀 InstaScrape API

Instant web scraping API - Get any website data in seconds!

## ⚖️ Legal Notice

**IMPORTANT**: This API is designed for scraping publicly available data only. Users must:

- ✅ Respect target website's robots.txt files
- ✅ Follow reasonable rate limiting (max 1 request/sec per domain)
- ✅ Only scrape publicly accessible content
- ✅ Comply with target website's Terms of Service

- ❌ Do NOT scrape behind login walls
- ❌ Do NOT ignore robots.txt
- ❌ Do NOT overload servers
- ❌ Do NOT scrape private/personal data

## 🛡️ Security Features

- Rate limiting (100 requests per 15 minutes per IP)
- Domain blacklisting for problematic sites
- Payment verification before scraping
- Comprehensive logging for legal protection
- Helmet.js security headers

## 💰 Pricing Tiers

| Tier | Price | Features |
|------|-------|----------|
| **Basic** | €5 | Title, description, headers, basic links |
| **Premium** | €20 | Custom selectors, full HTML, text extraction |
| **Custom** | €50 | Advanced options, wait conditions, complex data |

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd instascrape-api
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
```bash
cp env.example .env
# Edit .env with your Stripe keys
```

### 4. Run the API
```bash
# Development
npm run dev

# Production
npm start
```

## 🔧 API Documentation

### Base URL
```
http://localhost:3000
```

### Endpoints

#### 1. Landing Page
```
GET /
```
Returns the API documentation and pricing information.

#### 2. Create Payment Intent
```
POST /create-payment
Content-Type: application/json

{
  "tier": "basic" // "basic", "premium", or "custom"
}
```

Response:
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentId": "pi_xxx"
}
```

#### 3. Scrape Website
```
POST /scrape
Content-Type: application/json

{
  "url": "https://example.com",
  "paymentId": "pi_xxx",
  "tier": "basic",
  "options": {
    "selector": "h1, p",
    "type": "text",
    "waitFor": ".content"
  }
}
```

**Options:**
- `selector`: CSS selector for specific elements
- `type`: "text" or "html" for content type
- `waitFor`: CSS selector to wait for before scraping

#### 4. Health Check
```
GET /health
```
Returns API status and timestamp.

## 🛠️ Development

### Project Structure
```
instascrape-api/
├── index.js          # Main API server
├── package.json      # Dependencies and scripts
├── env.example       # Environment variables template
├── README.md         # This file
└── .gitignore        # Git ignore rules
```

### Adding New Features

1. **New Scraping Options**: Modify the `scrapeWebsite` function in `index.js`
2. **Additional Security**: Add new middleware or validation functions
3. **Database Integration**: Add database connection and models
4. **Caching**: Implement Redis for request caching

## 🚀 Deployment

### Vercel
```bash
npm install -g vercel
vercel
```

### Heroku
```bash
heroku create your-app-name
heroku config:set STRIPE_SECRET_KEY=sk_test_xxxxx
git push heroku main
```

### Docker
```bash
docker build -t instascrape-api .
docker run -p 3000:3000 instascrape-api
```

## 📊 Monitoring & Analytics

### Success Metrics
- **First 24h**: €100 (20 basic calls)
- **Week 1**: €500
- **Month 1**: €2000

### Logging
All scraping requests are logged with:
- URL being scraped
- Payment ID
- Timestamp
- Success/failure status

## 🔒 Security Considerations

1. **Rate Limiting**: Prevents abuse and server overload
2. **Domain Blacklisting**: Avoids legal issues with problematic sites
3. **Payment Verification**: Ensures only paid requests are processed
4. **Input Validation**: Prevents malicious URLs and payloads
5. **Error Handling**: Graceful failure without exposing internals

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## ⚠️ Disclaimer

This API is provided as-is. Users are responsible for:
- Complying with target website terms of service
- Respecting robots.txt files
- Using reasonable rate limits
- Not scraping private or personal data

The developers are not liable for misuse of this API. 