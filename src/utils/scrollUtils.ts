/**
 * Smoothly scrolls to a new position when new content is loaded
 * @param container The container element that has new content
 * @param offset Optional offset to adjust final scroll position
 */
export function smoothScrollOnNewContent(
  container: HTMLElement | null, 
  offset: number = 80
): void {
  if (!container) return;
  
  // Get current scroll position
  const currentScroll = window.scrollY;
  
  // Get container's position
  const rect = container.getBoundingClientRect();
  const containerBottom = rect.bottom + window.scrollY;
  
  // Only scroll if we're already near the container's bottom
  // Increased threshold for a more responsive feel
  const isNearBottom = 
    containerBottom - (window.innerHeight + currentScroll) < 300;
  
  if (isNearBottom) {
    // Calculate target position with offset
    const targetPosition = containerBottom - window.innerHeight + offset;
    
    // Only scroll if it would move us forward
    if (targetPosition > currentScroll) {
      // Use a more gentle scroll animation with custom easing
      const startPosition = currentScroll;
      const distance = targetPosition - startPosition;
      const duration = 400; // ms
      const startTime = performance.now();
      
      // Easing function for more natural feel
      const easeOutCubic = (t: number): number => {
        return 1 - Math.pow(1 - t, 3);
      };
      
      // Perform the scroll animation
      function scrollAnimation(currentTime: number) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = easeOutCubic(progress);
        
        window.scrollTo({
          top: startPosition + distance * easeProgress,
          behavior: 'auto' // We're manually animating
        });
        
        if (progress < 1) {
          requestAnimationFrame(scrollAnimation);
        }
      }
      
      requestAnimationFrame(scrollAnimation);
    }
  }
}

/**
 * Adds a reveal animation to newly loaded elements in a container
 * @param container The container element with new child elements
 * @param animationClass The CSS animation class to apply (e.g., 'slide-up')
 * @param startIndex Index of the first new element
 */
export function animateNewElements(
  container: HTMLElement | null,
  animationClass: string = 'slide-up',
  startIndex: number = 0
): void {
  if (!container) return;
  
  // Get all child elements
  const children = Array.from(container.children);
  
  // Apply animation class to new elements
  children.slice(startIndex).forEach((element, index) => {
    // Add animation class with delay based on index
    const htmlElement = element as HTMLElement;
    htmlElement.style.animationDelay = `${index * 0.05}s`;
    htmlElement.classList.add(animationClass);
    
    // Remove animation class after animation completes
    const animationDuration = 500; // Default animation duration in ms
    setTimeout(() => {
      htmlElement.classList.remove(animationClass);
      htmlElement.style.animationDelay = '';
    }, animationDuration + (index * 50));
  });
} 