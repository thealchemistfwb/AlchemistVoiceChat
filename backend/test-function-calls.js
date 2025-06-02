const { GoogleGenAI, Type } = require('@google/genai');
require('dotenv').config();

async function testFunctionCalling() {
  console.log('🧪 Testing Gemini function calling...');
  
  try {
    const genAI = new GoogleGenAI({
      apiKey: process.env.GOOGLE_AI_API_KEY
    });

    const tools = [{
      functionDeclarations: [{
        name: "suggestCategory",
        description: "Suggest a budget category for a transaction",
        parameters: {
          type: "object",
          properties: {
            txId: { type: "string", description: "Transaction ID" },
            suggestion: { 
              type: "string", 
              enum: ["foundations", "delights", "nest_egg", "wild_cards"],
              description: "Suggested category" 
            },
            confidence: { type: "number", description: "Confidence 0.0-1.0" }
          },
          required: ["txId", "suggestion", "confidence"]
        }
      }]
    }];

    console.log('🔧 Available methods on genAI:', Object.getOwnPropertyNames(genAI));
    
    // Try getGenerativeModel first
    console.log('🔧 Attempting getGenerativeModel...');
    try {
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp',
        tools: tools,
        toolConfig: { functionCallingConfig: { mode: 'ANY' } }
      });
      const prompt = `Categorize this transaction: tx_123 - Starbucks $4.50. Use the suggestCategory function.`;
      response = await model.generateContent(prompt);
      console.log('✅ getGenerativeModel worked!');
    } catch (getModelError) {
      console.log('❌ getGenerativeModel failed:', getModelError.message);
      console.log('🔧 Falling back to genAI.models...');
      const prompt = `Categorize this transaction: tx_123 - Starbucks $4.50. Use the suggestCategory function.`;
      response = await genAI.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: tools
      });
    }

    console.log('✅ Response received');
    console.log('🔧 Response keys:', Object.keys(response));
    
    const candidate = response.candidates?.[0];
    console.log('🔧 Candidate keys:', Object.keys(candidate || {}));
    
    if (candidate?.content?.parts) {
      console.log('🔧 Parts found:', candidate.content.parts.length);
      candidate.content.parts.forEach((part, i) => {
        console.log(`Part ${i}:`, Object.keys(part));
        if (part.functionCall) {
          console.log('✅ FUNCTION CALL FOUND:', part.functionCall);
        }
        if (part.text) {
          console.log('📝 Text:', part.text);
        }
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFunctionCalling();