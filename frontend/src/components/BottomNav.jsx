import React from 'react';
import { Home, History, Users, Settings } from 'lucide-react';

export default function BottomNav({ activeTab, setActiveTab, isTop3, pendingCount = 0, pendingStaffCount = 0 }) {
  const tabs = [
    { id: 'home', label: 'Асосий', icon: Home, badge: pendingCount },
    { id: 'history', label: 'Тарих', icon: History },
    ...(isTop3 ? [{ id: 'employees', label: 'Ходимлар', icon: Users, badge: pendingStaffCount }] : []),
    { id: 'settings', label: 'Созламалар', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl">
      <div className="max-w-md mx-auto px-2 flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-col items-center justify-center w-full py-1 transition-colors duration-150 ${
                isActive ? 'text-blue-700 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-6 h-6 transition-transform ${isActive ? 'scale-110 stroke-[2.5]' : ''}`} />
                {tab.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 bg-red-600 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full ring-2 ring-white animate-bounce shadow">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 tracking-tight">{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-1 w-6 h-0.5 bg-blue-700 rounded-full"></span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
