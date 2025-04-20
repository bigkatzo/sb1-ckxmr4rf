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
      <span className="inline-block py-1 px-4">
        {text}
      </span>
      {/* Duplicate text to ensure smooth looping */}
      <span className="inline-block py-1 px-4">
        {text}
      </span>
    </>
  );

  return (
    <div className="w-full overflow-hidden bg-purple-900 text-white whitespace-nowrap">
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
            className="hover:underline cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            {content}
          </a>
        ) : (
          content
        )}
      </div>
    </div>
  );
} 