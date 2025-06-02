require('dotenv').config();
const http = require('http');

async function testTransactionsMessage() {
  console.log('🧪 Testing "What are my transactions?" message...');
  
  const message = 'What are my transactions?';
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
          
          // Check if it shows sample transactions
          const hasTransactionIds = result.message.includes('tx_starbucks') || result.message.includes('tx_grocery');
          const hasTransactionList = result.message.includes('Starbucks') || result.message.includes('Whole Foods');
          
          console.log('\n✅ Contains transaction IDs:', hasTransactionIds);
          console.log('✅ Contains transaction merchants:', hasTransactionList);
          
          if (hasTransactionIds || hasTransactionList) {
            console.log('\n🎉 SUCCESS! Sample transactions are being displayed!');
          } else {
            console.log('\n❌ Sample transactions are NOT being displayed');
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

testTransactionsMessage().catch(console.error);