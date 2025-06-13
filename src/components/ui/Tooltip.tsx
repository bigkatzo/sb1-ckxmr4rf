import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: React.ReactNode;
  content: string | React.ReactNode;
  trigger?: 'hover' | 'click' | 'both';
}

export function Tooltip({ children, content, trigger = 'both' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, arrowLeft: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detect if device supports touch
  const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate position for portal tooltip
  const calculatePosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipHeight = 60; // Approximate tooltip height
    const tooltipWidth = 256; // max-w-64 = 256px

    let top = rect.bottom + 8; // 8px gap
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;

    // Calculate arrow position relative to tooltip
    let arrowLeft = tooltipWidth / 2 - 4; // Center of tooltip minus half arrow width

    // Ensure tooltip doesn't go off-screen horizontally
    const padding = 16;
    if (left < padding) {
      arrowLeft = arrowLeft - (padding - left); // Adjust arrow when tooltip shifts right
      left = padding;
    } else if (left + tooltipWidth > window.innerWidth - padding) {
      arrowLeft = arrowLeft + (left + tooltipWidth - (window.innerWidth - padding)); // Adjust arrow when tooltip shifts left
      left = window.innerWidth - tooltipWidth - padding;
    }

    // Clamp arrow position to stay within tooltip bounds
    arrowLeft = Math.max(8, Math.min(arrowLeft, tooltipWidth - 16));

    // If tooltip would go below viewport, show it above
    if (top + tooltipHeight > window.innerHeight - padding) {
      top = rect.top - tooltipHeight - 8;
    }

    setPosition({ top, left, arrowLeft });
  };

  // Hide tooltip on scroll to prevent dragging behavior
  useEffect(() => {
    const handleScroll = () => {
      if (isVisible) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      window.addEventListener('scroll', handleScroll, true); // Use capture phase
      return () => window.removeEventListener('scroll', handleScroll, true);
    }
  }, [isVisible]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isVisible &&
        tooltipRef.current &&
        triggerRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    if (trigger === 'click' || trigger === 'both') {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isVisible, trigger]);

  const handleMouseEnter = () => {
    // Clear any pending hide timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }

    // Only use hover on non-touch devices or when trigger is hover-only
    if (!isTouchDevice || trigger === 'hover') {
      calculatePosition();
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    // Only hide on mouse leave for non-touch devices or hover-only trigger
    if (!isTouchDevice || trigger === 'hover') {
      // Add small delay to prevent flicker when moving to tooltip
      hoverTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 100);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Always handle click for touch devices, or when trigger includes click
    if (trigger === 'click' || trigger === 'both') {
      if (!isVisible) {
        calculatePosition();
      }
      setIsVisible(!isVisible);
    }
  };

  const handleTooltipMouseEnter = () => {
    // Clear hide timeout when hovering over tooltip
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const handleTooltipMouseLeave = () => {
    // Hide tooltip when leaving tooltip area (for hover triggers)
    if (!isTouchDevice && (trigger === 'hover' || trigger === 'both')) {
      setIsVisible(false);
    }
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const tooltipElement = isVisible && isMounted ? (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] pointer-events-auto"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onMouseEnter={handleTooltipMouseEnter}
      onMouseLeave={handleTooltipMouseLeave}
    >
      <div className="bg-gray-900 border border-gray-800 text-gray-100 p-3 rounded-md shadow-lg relative text-xs">
        {content}
        {/* Arrow pointing up */}
        <div 
          className="absolute -top-1 w-2 h-2 bg-gray-900 border-l border-t border-gray-800 rotate-45"
          style={{
            left: `${position.arrowLeft}px`
          }}
        ></div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        className="cursor-pointer"
        style={{ display: 'contents' }}
      >
        {children}
      </span>
      
      {/* Render tooltip in portal */}
      {tooltipElement && createPortal(tooltipElement, document.body)}
    </>
  );
} 