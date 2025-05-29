import React from 'react';
import DOMPurify from 'dompurify';
import './HtmlRenderer.css';

const HtmlRenderer = ({ content, sender }) => {
  // Strip markdown code block syntax if present
  let processedContent = content;
  if (content.startsWith('```html') && content.endsWith('```')) {
    processedContent = content.slice(7, -3).trim(); // Remove ```html and closing ```
  }
  
  // Configure DOMPurify to allow safe HTML elements
  const cleanHtml = DOMPurify.sanitize(processedContent, {
    ALLOWED_TAGS: [
      'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'strong', 'em', 'b', 'i', 'br', 'hr', 'blockquote',
      'code', 'pre', 'a', 'img'
    ],
    ALLOWED_ATTR: [
      'class', 'id', 'style', 'href', 'src', 'alt', 'title',
      'target', 'rel'
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i
  });

  // If content doesn't contain HTML tags, wrap it in a paragraph
  const hasHtmlTags = /<[^>]*>/g.test(processedContent);
  const finalContent = hasHtmlTags ? cleanHtml : `<p>${cleanHtml}</p>`;

  return (
    <div 
      className={`html-content ${sender}`}
      dangerouslySetInnerHTML={{ __html: finalContent }}
    />
  );
};

export default HtmlRenderer;