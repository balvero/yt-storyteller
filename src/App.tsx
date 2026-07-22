import { useState } from 'react';
import { SeriesProvider, useSeries } from './context/SeriesContext';
import { Sidebar } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';
import { SeriesDashboard } from './components/SeriesDashboard';
import { EpisodeCanvas } from './components/EpisodeCanvas';

function AppContent() {
  const { activeSeries, activeEpisode } = useSeries();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      <Sidebar onOpenSettings={() => setShowSettings(true)} />
      
      <main className="flex-1 overflow-y-auto relative">
        {activeEpisode ? (
          <EpisodeCanvas />
        ) : activeSeries ? (
          <SeriesDashboard />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500">
            <div className="text-center">
              <h2 className="text-xl font-black text-slate-400 mb-2">No Series Selected</h2>
              <p className="text-sm">Create or select a series from the sidebar to begin.</p>
            </div>
          </div>
        )}
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function App() {
  return (
    <SeriesProvider>
      <AppContent />
    </SeriesProvider>
  );
}

export default App;
