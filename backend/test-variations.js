require('dotenv').config();
const http = require('http');

async function testMessage(message) {
  console.log(`\n🧪 Testing: "${message}"`);
  
  const postData = JSON.stringify({ message });
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          const hasTransactions = result.message.includes('tx_starbucks') || result.message.includes('Starbucks');
          console.log(`   ✅ Shows transactions: ${hasTransactions}`);
          if (hasTransactions) {
            console.log(`   🎉 SUCCESS with: "${message}"`);
          }
          resolve(hasTransactions);
        } catch (error) {
          console.log(`   ❌ Error parsing response`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      console.log(`   ❌ Request error: ${error.message}`);
      resolve(false);
    });
    
    req.write(postData);
    req.end();
  });
}

async function testVariations() {
  console.log('🧪 Testing different message variations...');
  
  const messages = [
    'What are my transactions?',
    'what are my transactions?',
    'What are my transactions',
    'transactions',
    'show transactions',
    'categorize transactions',
    'categorize my transactions',
    'show my transactions'
  ];
  
  for (const message of messages) {
    await testMessage(message);
  }
}

testVariations().catch(console.error);