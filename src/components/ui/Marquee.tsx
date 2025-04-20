type MarqueeProps = {
  text: string;
  speed?: 'slow' | 'medium' | 'fast';
  link?: string;
};

export function Marquee({ text, speed = 'medium', link }: MarqueeProps) {
  // Calculate animation duration based on speed
  const getDuration = () => {
    const baseLength = text.length * 0.15; // Base duration depends on text length
    switch (speed) {
      case 'slow': return baseLength * 1.5;
      case 'fast': return baseLength * 0.5;
      default: return baseLength;
    }
  };

  const duration = getDuration();

  // Content to render
  const content = (
    <>
      <span className="inline-block py-1.5 px-4 font-medium">
        {text}
      </span>
      {/* Duplicate text to ensure smooth looping */}
      <span className="inline-block py-1.5 px-4 font-medium">
        {text}
      </span>
    </>
  );

  return (
    <div className={`w-full overflow-hidden text-white whitespace-nowrap shadow-lg border-b border-purple-800/30 ${
      link 
        ? 'bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-900 cursor-pointer' 
        : 'bg-gradient-to-r from-purple-900 to-purple-800'
    }`}>
      <div
        className="inline-block animate-marquee"
        style={{
          animationDuration: `${duration}s`,
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite'
        }}
      >
        {link ? (
          <a 
            href={link} 
            className="hover:underline cursor-pointer font-medium flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {content}
            {link && <span className="ml-1 text-xs opacity-90 bg-purple-700/60 px-2 py-0.5 rounded-full">Click for more →</span>}
          </a>
        ) : (
          content
        )}
      </div>
    </div>
  );
} 