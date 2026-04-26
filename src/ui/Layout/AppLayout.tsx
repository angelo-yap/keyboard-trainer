/* ─── src/ui/layout/AppLayout.tsx ───────────────────────────────────────────
   Top-level shell: thin topbar + tab content area.
   Replaces any existing AppLayout. Accepts the same activeTab / onTabChange
   props your App.tsx already passes.
   ──────────────────────────────────────────────────────────────────────── */

import React from 'react';
import './AppLayout.css';

type Tab = 'home' | 'learn' | 'test' | 'analytics' | 'settings';

interface AppLayoutProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  personalBest?: number;          /* wpm — pulled from your testHistoryStore */
  children: React.ReactNode;
}

const NAV_ITEMS: { id: Tab; label: string }[] = [
  { id: 'home',      label: 'home'      },
  { id: 'learn',     label: 'learn'     },
  { id: 'test',      label: 'test'      },
  { id: 'analytics', label: 'review'    },
  { id: 'settings',  label: 'settings'  },
];

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeTab,
  onTabChange,
  personalBest,
  children,
}) => {
  return (
    <div className="app-layout">
      <header className="app-topbar">
        <span className="app-wordmark">Typr</span>

        <nav className="app-nav" role="navigation" aria-label="Main navigation">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`app-nav-item${activeTab === item.id ? ' active' : ''}`}
              onClick={() => onTabChange(item.id)}
              aria-current={activeTab === item.id ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="app-topbar-right">
          {personalBest != null && (
            <span className="app-pb">
              personal best <strong>{personalBest} wpm</strong>
            </span>
          )}
        </div>
      </header>

      <main className="app-content scrollable">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
