import React from 'react';

/**
 * This component provides the exported HTML for the initial loading spinner
 * that appears in index.html before the React app loads.
 * 
 * Export this component's HTML to update index.html for a consistent loading experience.
 */
export const InitialLoadingSpinner: React.FC = () => {
  return (
    <div id="loading-screen" aria-label="Loading">
      <div className="loading-box">
        <div className="loading-spinner"></div>
        <div className="loading-box-inner" aria-hidden="true">
          <img 
            src="https://sakysysfksculqobozxi.supabase.co/storage/v1/object/public/site-assets/logo-icon.svg" 
            alt="store.fun" 
            width="62" 
            height="62" 
            style={{ 
              width: '62px', 
              height: '62px',
              objectFit: 'contain',
              margin: 'auto'
            }} 
          />
        </div>
      </div>
      <div className="loading-text">store.fun</div>
    </div>
  );
};

/**
 * CSS styles for the initial loading spinner.
 * This can be copied into the head of index.html or imported as a stylesheet.
 */
export const initialLoadingSpinnerStyles = `
  #loading-screen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: var(--color-gray-950);
    z-index: 9999;
    transition: opacity 0.3s ease-out;
  }
  
  .loading-box {
    position: relative;
    width: 96px;
    height: 96px;
    margin-bottom: 20px;
  }
  
  .loading-box-inner {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    transform-origin: center;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  .loading-spinner {
    position: absolute;
    top: -16px;
    left: -16px;
    right: -16px;
    bottom: -16px;
    border-radius: 50%;
    border: 4px solid transparent;
    border-top-color: var(--color-primary);
    border-left-color: var(--color-primary-light);
    animation: spin 1.5s linear infinite;
  }
  
  .loading-text {
    margin-top: 12px;
    color: white;
    font-size: 18px;
    font-weight: 500;
    letter-spacing: 0.05em;
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  .loading-hidden {
    opacity: 0;
    pointer-events: none;
  }
`;

export default InitialLoadingSpinner; 