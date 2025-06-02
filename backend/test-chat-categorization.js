require('dotenv').config();
const fetch = require('node-fetch');

async function testChatCategorization() {
  console.log('🧪 Testing chat categorization endpoint...');
  
  const message = 'categorize my transactions';
  
  try {
    console.log(`\n📤 Sending message: "${message}"`);
    
    const response = await fetch('http://localhost:3001/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log('\n📥 Response:');
    console.log(result.message);
    
  } catch (error) {
    console.error('❌ Error testing chat categorization:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the server is running: npm start');
    }
  }
}

testChatCategorization();