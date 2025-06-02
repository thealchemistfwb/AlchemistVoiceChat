require('dotenv').config();
const http = require('http');

async function testAccountBalance() {
  console.log('🧪 Testing account balance query...');
  
  const message = "What's my checking account at?";
  const postData = JSON.stringify({ 
    message,
    accessToken: 'access-sandbox-3587461d-f279-434f-ac6d-931b75d491d5'
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
          
          // Check if it shows account balance
          const mentionsBalance = result.message.includes('$118') || result.message.includes('110') || result.message.includes('balance');
          const isGenericResponse = result.message.includes("I can't directly access") || result.message.length > 1000;
          
          console.log('\n✅ Mentions account balance/amount:', mentionsBalance);
          console.log('❌ Generic long response:', isGenericResponse);
          
          if (mentionsBalance && !isGenericResponse) {
            console.log('\n🎉 SUCCESS! Account balance working!');
          } else {
            console.log('\n❌ Account balance not working properly');
            console.log('📝 Response preview:');
            console.log(result.message.substring(0, 300) + '...');
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

testAccountBalance().catch(console.error);