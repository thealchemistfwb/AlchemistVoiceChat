require('dotenv').config();
const http = require('http');

async function testChatSimple() {
  console.log('🧪 Testing chat categorization with simple HTTP...');
  
  const message = 'categorize my transactions';
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
      console.log(`📥 Status: ${res.statusCode}`);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('\n📥 Response message:');
          console.log(result.message);
          resolve(result);
        } catch (error) {
          console.log('\n📥 Raw response:');
          console.log(data);
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

testChatSimple().catch(console.error);