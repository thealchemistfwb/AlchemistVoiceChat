const message = "Categorize tx_123 and tx_456 please";

console.log('Testing pattern matching...');
console.log('Message:', message);

const hasCategor = message.toLowerCase().includes('categor');
const hasTxId = message.toLowerCase().includes('tx_');
const hasTransaction = message.toLowerCase().includes('transaction');

console.log('Contains "categor":', hasCategor);
console.log('Contains "tx_":', hasTxId);
console.log('Contains "transaction":', hasTransaction);

const shouldTrigger = hasCategor || hasTxId || hasTransaction;
console.log('Should trigger auto-generation:', shouldTrigger);

if (shouldTrigger) {
  const txIdPattern = /tx_(\w+)/g;
  let txMatch;
  const found = [];
  
  while ((txMatch = txIdPattern.exec(message)) !== null) {
    const txId = `tx_${txMatch[1]}`;
    found.push(txId);
  }
  
  console.log('Found transaction IDs:', found);
}