import { Send, Mail } from 'lucide-react';

export function SupportMessage() {
  return (
    <div className="flex items-center gap-3 p-3 bg-secondary/10 rounded-lg whitespace-nowrap">
      <p className="text-sm text-secondary-light">Need help?</p>
      <div className="flex items-center gap-3">
        <a
          href="https://t.me/storedotfun"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-secondary-light"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Telegram</span>
        </a>
        <a
          href="mailto:support@store.fun"
          className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-secondary-light"
        >
          <Mail className="h-3.5 w-3.5" />
          <span>Email</span>
        </a>
      </div>
    </div>
  );
} 