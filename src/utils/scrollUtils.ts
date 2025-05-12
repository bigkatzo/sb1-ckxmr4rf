/**
 * Smoothly scrolls to a new position when new content is loaded
 * @param container The container element that has new content
 * @param offset Optional offset to adjust final scroll position
 */
export function smoothScrollOnNewContent(
  container: HTMLElement | null, 
  offset: number = 100
): void {
  if (!container) return;
  
  // Get current scroll position
  const currentScroll = window.scrollY;
  
  // Get container's position
  const rect = container.getBoundingClientRect();
  const containerBottom = rect.bottom + window.scrollY;
  
  // Only scroll if we're already near the container's bottom
  const isNearBottom = 
    containerBottom - (window.innerHeight + currentScroll) < 200;
  
  if (isNearBottom) {
    // Calculate target position with offset
    const targetPosition = containerBottom - window.innerHeight + offset;
    
    // Only scroll if it would move us forward
    if (targetPosition > currentScroll) {
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
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