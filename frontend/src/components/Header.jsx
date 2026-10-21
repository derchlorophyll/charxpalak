import React from 'react';
import { Download, WifiOff } from 'lucide-react';

export default function Header({ user, installPrompt, onInstall, restaurantName }) {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-blue-900 via-blue-800 to-sky-800 text-white shadow-md border-b border-blue-900/40">
      <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <img 
            src="/logo.png" 
            alt="Чархпалак" 
            className="w-10 h-10 rounded-xl object-contain bg-white p-0.5 shadow-md border border-sky-300/40"
          />
          <div>
            <h1 className="font-black text-base tracking-tight leading-tight">
              {restaurantName || 'Чархпалак Чойхонаси'}
            </h1>
            {user ? (
              <div className="flex items-center space-x-1.5 text-xs text-sky-100 font-medium">
                <span className="truncate max-w-[140px] font-bold">{user.full_name}</span>
                <span className="inline-block w-1 h-1 rounded-full bg-sky-300"></span>
                <span className="bg-blue-950/60 px-1.5 py-0.2 rounded text-[11px] font-semibold border border-sky-400/30 text-sky-200">
                  {user.role_title}
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-sky-200">Ходимлар ва молия тизими</span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {installPrompt && (
            <button
              onClick={onInstall}
              className="flex items-center space-x-1 bg-sky-500 hover:bg-sky-400 text-white text-xs px-2.5 py-1.5 rounded-xl font-bold shadow-sm active:scale-95 transition-all border border-sky-300/40"
              title="Дастурни ўрнатиш"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ўрнатиш</span>
            </button>
          )}

          <div title={isOnline ? 'Интернет уланган' : 'Офлайн режим'}>
            {isOnline ? (
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-300/50"></span>
            ) : (
              <WifiOff className="w-4 h-4 text-red-300 animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
