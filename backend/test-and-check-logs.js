require('dotenv').config();
const http = require('http');

async function testAndCheckLogs() {
  console.log('🧪 Testing with Gemini 2.5 Pro and checking logs...');
  
  const message = 'Show me my spending breakdown';
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
          
          // Check if response starts with HTML
          const startsWithHTML = result.message.trim().startsWith('<');
          console.log('\n✅ Response starts with HTML tag:', startsWithHTML);
          
          if (startsWithHTML) {
            console.log('\n🎉 SUCCESS! HTML formatting is working!');
            console.log('📝 HTML preview:');
            console.log(result.message.substring(0, 200) + '...');
          } else {
            console.log('\n❌ Still getting plain text response');
            console.log('📝 Text preview:');
            console.log(result.message.substring(0, 200) + '...');
          }
          
          resolve(result);
        } catch (error) {
          console.log('\n📥 Raw response:');
          console.log(data.substring(0, 200) + '...');
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

testAndCheckLogs().catch(console.error);