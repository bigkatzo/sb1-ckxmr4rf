 

interface RichTextDisplayProps {
  content: string;
  className?: string;
}

// Simple HTML sanitizer for our limited use case
function sanitizeHTML(html: string): string {
  // Only allow specific tags that we support in the editor
  const allowedTags = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'br'];
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
  
  return html.replace(tagRegex, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      // For our specific use case, we only need class attributes for lists
      if (tagName.toLowerCase() === 'ul') {
        return '<ul class="rich-text-bullet-list">';
      } else if (tagName.toLowerCase() === 'ol') {
        return '<ol class="rich-text-ordered-list">';
      }
      return match.replace(/\s+class="[^"]*"/g, ''); // Remove other class attributes
    }
    return ''; // Remove disallowed tags
  });
}

export function RichTextDisplay({ content, className = "" }: RichTextDisplayProps) {
  // If content is empty or just whitespace, return nothing
  if (!content || content.trim() === '' || content === '<p></p>') {
    return null;
  }

  // Check if content contains HTML tags (rich text) or is plain text
  const hasHTMLTags = /<[^>]*>/g.test(content);
  
  if (!hasHTMLTags) {
    // Handle plain text content by converting line breaks to HTML
    const plainTextWithBreaks = content
      .split('\n')
      .map((line) => line.trim())
      .filter(line => line.length > 0)
      .join('<br />');
    
    return (
      <div 
        className={`rich-text-content ${className}`}
        dangerouslySetInnerHTML={{ __html: plainTextWithBreaks }}
        style={{
          color: 'inherit',
        }}
      />
    );
  }

  // Sanitize the HTML content for rich text
  const sanitizedContent = sanitizeHTML(content);

  return (
    <div 
      className={`rich-text-content ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      style={{
        color: 'inherit',
      }}
    />
  );
}

// Fallback display for when DOMPurify is not available (SSR or build issues)
export function RichTextDisplayFallback({ content, className = "" }: RichTextDisplayProps) {
  // Simple fallback that strips HTML tags and shows plain text
  const plainText = content.replace(/<[^>]*>/g, '').trim();
  
  if (!plainText) {
    return null;
  }

  return (
    <div className={className}>
      {plainText.split('\n').map((line, idx) => (
        <p key={idx} className="mb-2 last:mb-0">
          {line}
        </p>
      ))}
    </div>
  );
} 