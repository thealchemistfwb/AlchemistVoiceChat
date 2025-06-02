// Test the HTML conversion function
function convertToHTML(text) {
  if (!text) return '';
  
  // If already has HTML tags, return as-is
  if (text.includes('<h3>') || text.includes('<p>')) {
    return text;
  }
  
  // Split into paragraphs and convert
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  let html = '';
  
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();
    if (!para) continue;
    
    // First paragraph becomes header if it's short and doesn't have special formatting
    if (i === 0 && para.length < 60 && !para.includes('*') && !para.includes('-')) {
      html += `<h3>${para}</h3>`;
    } else {
      // Convert markdown-style formatting
      let htmlPara = para
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
        .replace(/\n/g, '<br>'); // Line breaks
      
      // Handle bullet points
      if (htmlPara.includes('•') || htmlPara.includes('*   ')) {
        const lines = htmlPara.split('\n');
        const listItems = lines
          .filter(line => line.trim().startsWith('•') || line.trim().startsWith('*'))
          .map(line => `<li>${line.replace(/^[•*]\s*/, '').trim()}</li>`)
          .join('');
        
        if (listItems) {
          html += `<ul>${listItems}</ul>`;
        } else {
          html += `<p>${htmlPara}</p>`;
        }
      } else {
        html += `<p>${htmlPara}</p>`;
      }
    }
  }
  
  return html || `<p>${text}</p>`;
}

// Test it
const testText = `Okay, here's your spending breakdown!

This is a test paragraph with some content.

**Bold text** and *italic text* should be converted.

Here are some bullet points:
* First item
* Second item
* Third item`;

console.log('🧪 Testing HTML conversion...');
console.log('\n📝 Input:');
console.log(testText);
console.log('\n🔄 Output:');
console.log(convertToHTML(testText));
console.log('\n✅ Test complete');