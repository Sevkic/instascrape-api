const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_URL = 'https://httpbin.org/html';

async function runTests() {
  console.log('🧪 Testing InstaScrape API...\n');

  try {
    // Test 1: Health check
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data);
    console.log('');

    // Test 2: Landing page
    console.log('2️⃣ Testing landing page...');
    const landingResponse = await axios.get(BASE_URL);
    console.log('✅ Landing page loaded (length:', landingResponse.data.length, 'chars)');
    console.log('');

    // Test 3: Create payment intent (without real Stripe key)
    console.log('3️⃣ Testing payment intent creation...');
    try {
      const paymentResponse = await axios.post(`${BASE_URL}/create-payment`, {
        tier: 'basic'
      });
      console.log('✅ Payment intent created:', paymentResponse.data);
    } catch (error) {
      console.log('⚠️  Payment test failed (expected without Stripe key):', error.response?.data?.error || error.message);
    }
    console.log('');

    // Test 4: URL validation
    console.log('4️⃣ Testing URL validation...');
    const testUrls = [
      'https://example.com',
      'https://facebook.com',
      'invalid-url',
      'https://httpbin.org/html'
    ];

    for (const url of testUrls) {
      try {
        const response = await axios.post(`${BASE_URL}/scrape`, {
          url: url,
          paymentId: 'test_payment_id',
          tier: 'basic'
        });
        console.log(`✅ URL ${url}: Valid`);
      } catch (error) {
        const status = error.response?.status;
        const message = error.response?.data?.error || error.message;
        console.log(`❌ URL ${url}: ${status} - ${message}`);
      }
    }

    console.log('\n🎉 All tests completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Set up your Stripe keys in .env file');
    console.log('2. Run: npm install');
    console.log('3. Run: npm run dev');
    console.log('4. Test with real payments!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the API is running on port 3000');
    console.log('   Run: npm run dev');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests }; 