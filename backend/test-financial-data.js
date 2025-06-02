require('dotenv').config();
const { getFinancialSummary } = require('./plaidClient');

async function testFinancialData() {
  console.log('🧪 Testing financial data retrieval...');
  
  try {
    // Test with invalid token
    console.log('\n📤 Testing with mock access token...');
    const financialData = await getFinancialSummary('test_access_token_123');
    console.log('✅ Financial data retrieved:', JSON.stringify(financialData, null, 2));
  } catch (error) {
    console.log('❌ Error with mock token:', error.message);
  }
  
  try {
    // Test with no token
    console.log('\n📤 Testing with no access token...');
    const financialData2 = await getFinancialSummary(null);
    console.log('✅ Financial data retrieved:', JSON.stringify(financialData2, null, 2));
  } catch (error) {
    console.log('❌ Error with no token:', error.message);
  }
}

testFinancialData();