import { useEffect } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import { Bold as BoldIcon, Italic as ItalicIcon, List, ListOrdered } from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function RichTextEditor({ 
  content, 
  onChange, 
  placeholder = "Enter description...", 
  className = "",
  disabled = false
}: RichTextEditorProps) {
  // Convert plain text to HTML format for the editor
  const processContentForEditor = (rawContent: string): string => {
    if (!rawContent || rawContent.trim() === '') return '';
    
    // Check if content already contains HTML tags
    const hasHTMLTags = /<[^>]*>/g.test(rawContent);
    
    if (!hasHTMLTags) {
      // Convert plain text to HTML paragraphs
      const lines = rawContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length === 0) return '';
      if (lines.length === 1) return `<p>${lines[0]}</p>`;
      return lines.map(line => `<p>${line}</p>`).join('');
    }
    
    return rawContent;
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable default extensions we want to configure separately
        bold: false,
        italic: false,
        bulletList: false,
        orderedList: false,
      }),
      Bold,
      Italic,
      BulletList.configure({
        HTMLAttributes: {
          class: 'rich-text-bullet-list',
        },
      }),
      OrderedList.configure({
        HTMLAttributes: {
          class: 'rich-text-ordered-list',
        },
      }),
    ],
    content: processContentForEditor(content),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'rich-text-content focus:outline-none min-h-[80px] p-3',
      },
    },
  });

  useEffect(() => {
    if (editor) {
      const processedContent = processContentForEditor(content);
      if (processedContent !== editor.getHTML()) {
        editor.commands.setContent(processedContent);
      }
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className={`border border-gray-700 rounded-lg bg-gray-800 focus-within:ring-2 focus-within:ring-primary ${className}`}>
      {/* Editor Content */}
      <div className="text-white relative">
        <EditorContent editor={editor} />
        
        {/* Bubble Menu - appears only when text is selected */}
        {editor && (
          <BubbleMenu 
            editor={editor} 
            tippyOptions={{ 
              duration: 100,
              placement: 'top',
              offset: [0, 8],
            }}
            className="flex items-center gap-1 p-2 bg-gray-900 border border-gray-600 rounded-lg shadow-lg"
          >
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`p-2 rounded text-sm transition-colors ${
                editor.isActive('bold')
                  ? 'bg-primary text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
              disabled={disabled}
              title="Bold"
            >
              <BoldIcon className="h-4 w-4" />
            </button>
            
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`p-2 rounded text-sm transition-colors ${
                editor.isActive('italic')
                  ? 'bg-primary text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
              disabled={disabled}
              title="Italic"
            >
              <ItalicIcon className="h-4 w-4" />
            </button>
            
            <div className="w-px h-6 bg-gray-600 mx-1" />
            
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`p-2 rounded text-sm transition-colors ${
                editor.isActive('bulletList')
                  ? 'bg-primary text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
              disabled={disabled}
              title="Bullet List"
            >
              <List className="h-4 w-4" />
            </button>
            
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`p-2 rounded text-sm transition-colors ${
                editor.isActive('orderedList')
                  ? 'bg-primary text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
              disabled={disabled}
              title="Numbered List"
            >
              <ListOrdered className="h-4 w-4" />
            </button>
          </BubbleMenu>
        )}
        
        {(!content || content.trim() === '' || content === '<p></p>') && (
          <div className="absolute inset-0 top-0 p-3 pointer-events-none text-gray-500 text-sm">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

// Add CSS for rich text display
export const richTextStyles = `
  .rich-text-content {
    color: inherit;
  }
  
  .rich-text-content p {
    margin-bottom: 0.5rem;
  }
  
  .rich-text-content p:last-child {
    margin-bottom: 0;
  }
  
  .rich-text-content strong {
    font-weight: 600;
  }
  
  .rich-text-content em {
    font-style: italic;
  }
  
  .rich-text-content .rich-text-bullet-list {
    list-style-type: disc;
    margin-left: 1.5rem;
    margin-bottom: 0.5rem;
  }
  
  .rich-text-content .rich-text-bullet-list li {
    margin-bottom: 0.25rem;
  }
  
  .rich-text-content .rich-text-ordered-list {
    list-style-type: decimal;
    margin-left: 1.5rem;
    margin-bottom: 0.5rem;
  }
  
  .rich-text-content .rich-text-ordered-list li {
    margin-bottom: 0.25rem;
  }
  
  .rich-text-content ul, .rich-text-content ol {
    margin-bottom: 0.5rem;
  }
  
  .rich-text-content ul:last-child, .rich-text-content ol:last-child {
    margin-bottom: 0;
  }
`; 