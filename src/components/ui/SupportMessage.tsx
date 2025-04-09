import { Send, Mail } from 'lucide-react';

export function SupportMessage() {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-purple-500/10 rounded-lg">
      <p className="text-sm text-purple-300">Need help with your order?</p>
      <div className="flex items-center gap-3">
        <a
          href="https://t.me/storedotfun"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Telegram</span>
        </a>
        <a
          href="mailto:support@store.fun"
          className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300"
        >
          <Mail className="h-3.5 w-3.5" />
          <span>Email</span>
        </a>
      </div>
    </div>
  );
} 