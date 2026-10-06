import React, { useEffect } from 'react';
import { AppProvider } from './context/AppContext';
import { Cx3SettingsProvider } from './context/Cx3SettingsContext';
import { WxScreenProvider } from './context/WxScreenContext';
import { ConvIcaoProvider } from './context/ConvIcaoContext';
import Cx3Device from './components/layout/Cx3Device';

export default function App() {
  useEffect(() => {
    // Capacitor Keyboard 플러그인을 사용하여 키보드 리사이즈 방지 (모바일 앱에서만)
    if (typeof window !== 'undefined' && window.Capacitor) {
      const setupKeyboard = async () => {
        try {
          const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
          await Keyboard.setResizeMode({ mode: KeyboardResize.None });
        } catch (error) {
          console.warn('Capacitor Keyboard plugin not available', error);
        }
      };
      
      setupKeyboard();
    }
  }, []);

  return (
    <AppProvider>
      <Cx3SettingsProvider>
        <WxScreenProvider>
          <ConvIcaoProvider>
            <Cx3Device />
          </ConvIcaoProvider>
        </WxScreenProvider>
      </Cx3SettingsProvider>
    </AppProvider>
  );
}
