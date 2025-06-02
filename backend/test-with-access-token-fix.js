require('dotenv').config();
const http = require('http');

async function testWithAccessToken() {
  console.log('🧪 Testing with access token (simulating button click)...');
  
  const message = 'What are my transactions?';
  const postData = JSON.stringify({ 
    message,
    accessToken: 'fake_token_that_would_cause_plaid_error'
  });
  
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
      console.log(`📥 Status: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          // Check if it shows sample transactions instead of trying Plaid
          const hasTransactionIds = result.message.includes('tx_starbucks') || result.message.includes('tx_grocery');
          const hasTransactionList = result.message.includes('Starbucks') || result.message.includes('Whole Foods');
          const hasPlaidError = result.message.includes('sandbox') || result.message.includes('Plaid');
          
          console.log('\n✅ Contains sample transaction IDs:', hasTransactionIds);
          console.log('✅ Contains sample transaction merchants:', hasTransactionList);
          console.log('❌ Contains Plaid error:', hasPlaidError);
          
          if ((hasTransactionIds || hasTransactionList) && !hasPlaidError) {
            console.log('\n🎉 SUCCESS! Shows sample transactions and avoids Plaid errors!');
          } else if (hasPlaidError) {
            console.log('\n❌ Still getting Plaid errors');
          } else {
            console.log('\n❌ Not showing sample transactions');
          }
          
          resolve(result);
        } catch (error) {
          console.log('\n📥 Raw response:');
          console.log(data.substring(0, 300) + '...');
          resolve(data);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error.message);
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

testWithAccessToken().catch(console.error);