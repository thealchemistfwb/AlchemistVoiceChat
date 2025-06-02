require('dotenv').config();
const http = require('http');

async function testWithAccessToken() {
  console.log('🧪 Testing with mock access token...');
  
  const message = 'Show me my spending breakdown';
  const postData = JSON.stringify({ 
    message,
    accessToken: 'test_access_token_123' // Mock token
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
          console.log('\n📥 Response message:');
          console.log(result.message.substring(0, 500) + '...');
          
          if (result.charts) {
            console.log('\n📊 Charts generated:', result.charts.length);
          }
          
          // Check if HTML formatting is used
          const hasHTML = result.message.includes('<h3>') || result.message.includes('<p>');
          console.log('\n✅ HTML formatting detected:', hasHTML);
          
          resolve(result);
        } catch (error) {
          console.log('\n📥 Raw response:');
          console.log(data.substring(0, 500) + '...');
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