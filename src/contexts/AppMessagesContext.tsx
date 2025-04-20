import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Marquee } from '../components/ui/Marquee';
import { Popup } from '../components/ui/Popup';

type AppMessage = {
  id: string;
  type: 'marquee' | 'popup';
  content: string;
  marquee_speed?: 'slow' | 'medium' | 'fast';
  marquee_link?: string;
  background_color?: string;
  text_color?: string;
  header_image_url?: string;
  cta_text?: string;
  cta_link?: string;
};

type AppMessagesContextType = {
  hasSeenPopup: boolean;
  markPopupAsSeen: () => void;
  activeMarquee: AppMessage | null;
  activePopup: AppMessage | null;
};

const AppMessagesContext = createContext<AppMessagesContextType>({
  hasSeenPopup: false,
  markPopupAsSeen: () => {},
  activeMarquee: null,
  activePopup: null
});

const LOCAL_STORAGE_POPUP_KEY = 'store_fun_popup_seen';

export function AppMessagesProvider({ children }: { children: React.ReactNode }) {
  const [activeMarquee, setActiveMarquee] = useState<AppMessage | null>(null);
  const [activePopup, setActivePopup] = useState<AppMessage | null>(null);
  const [hasSeenPopup, setHasSeenPopup] = useState(true); // Default to true to avoid showing popup initially

  // Fetch active messages on mount
  useEffect(() => {
    fetchActiveMessages();
    
    // Subscribe to changes in the app_messages table
    const subscription = supabase
      .channel('app_messages_changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'app_messages' 
      }, () => {
        fetchActiveMessages();
      })
      .subscribe();
    
    // Check if user has already seen the popup
    const popupSeen = localStorage.getItem(LOCAL_STORAGE_POPUP_KEY);
    if (popupSeen) {
      setHasSeenPopup(true);
    } else {
      setHasSeenPopup(false);
    }
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function fetchActiveMessages() {
    try {      
      console.log('Fetching active app messages...');
      
      // Use the get_active_app_messages() function
      const { data, error } = await supabase
        .rpc('get_active_app_messages');
      
      if (error) {
        console.error('Error fetching active messages:', error);
        return;
      }
      
      console.log('Active messages response:', data);
      
      if (data && data.length > 0) {
        // Find the most recent marquee and popup
        const marquee = data.find((msg: AppMessage) => msg.type === 'marquee');
        const popup = data.find((msg: AppMessage) => msg.type === 'popup');
        
        console.log('Active marquee found:', marquee);
        console.log('Active popup found:', popup);
        
        setActiveMarquee(marquee || null);
        setActivePopup(popup || null);
      } else {
        console.log('No active messages found in database response');
        setActiveMarquee(null);
        setActivePopup(null);
      }
    } catch (err) {
      console.error('Unexpected error in fetchActiveMessages:', err);
    }
  }

  function markPopupAsSeen() {
    localStorage.setItem(LOCAL_STORAGE_POPUP_KEY, new Date().toISOString());
    setHasSeenPopup(true);
  }

  const marqueeComponent = activeMarquee ? (
    <div className="fixed top-0 left-0 right-0 z-[99999] w-full">
      <Marquee 
        text={activeMarquee.content} 
        speed={activeMarquee.marquee_speed}
        link={activeMarquee.marquee_link}
        backgroundColor={activeMarquee.background_color}
        textColor={activeMarquee.text_color}
      />
    </div>
  ) : null;

  const popupComponent = activePopup && !hasSeenPopup ? (
    <Popup
      content={activePopup.content}
      headerImageUrl={activePopup.header_image_url}
      ctaText={activePopup.cta_text}
      ctaLink={activePopup.cta_link}
      onClose={markPopupAsSeen}
    />
  ) : null;

  return (
    <AppMessagesContext.Provider value={{ 
      hasSeenPopup, 
      markPopupAsSeen,
      activeMarquee,
      activePopup
    }}>
      {/* Portal the components to ensure they're at the root level */}
      {marqueeComponent}
      {popupComponent}
      {children}
    </AppMessagesContext.Provider>
  );
}

export function useAppMessages() {
  return useContext(AppMessagesContext);
}

// New component to render messages in layout components
export function AppMessagesRenderer() {
  const { activeMarquee, activePopup, hasSeenPopup, markPopupAsSeen } = useAppMessages();
  
  return (
    <>
      {activeMarquee && (
        <div className="fixed top-0 left-0 right-0 z-[99999] w-full">
          <Marquee 
            text={activeMarquee.content} 
            speed={activeMarquee.marquee_speed}
            link={activeMarquee.marquee_link}
            backgroundColor={activeMarquee.background_color}
            textColor={activeMarquee.text_color}
          />
        </div>
      )}
      
      {activePopup && !hasSeenPopup && (
        <Popup
          content={activePopup.content}
          headerImageUrl={activePopup.header_image_url}
          ctaText={activePopup.cta_text}
          ctaLink={activePopup.cta_link}
          onClose={markPopupAsSeen}
        />
      )}
    </>
  );
} 