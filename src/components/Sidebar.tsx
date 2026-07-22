import React from 'react';
import { useSeries } from '../context/SeriesContext';
import { Plus, Settings, BookOpen, Film } from 'lucide-react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';

interface SidebarProps {
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenSettings }) => {
  const { allSeries, setActiveSeriesId, setActiveEpisodeId, createSeries } = useSeries();

  const handleCreateSeries = async () => {
    const id = await createSeries({
      title: 'New History Series',
      topicDescription: '',
      globalArtStyle: 'Modern cinematic documentary style, 85mm lens, dramatic lighting',
      targetAudience: 'History enthusiasts, ages 18-35',
      aspectRatio: '9:16',
    });
    setActiveSeriesId(id);
    setActiveEpisodeId(null);
  };

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen text-slate-300">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <h1 className="text-lg font-black text-amber-500 tracking-tight flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Storyteller
        </h1>
      </div>

      <div className="p-4">
        <button
          onClick={handleCreateSeries}
          className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-extrabold flex items-center justify-center gap-2 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" /> New Series
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 px-1 mt-2">Your Series</div>
        
        {allSeries.map(series => (
          <SeriesMenuItem key={series.id} seriesId={series.id} title={series.title} />
        ))}

        {allSeries.length === 0 && (
          <div className="text-xs text-slate-500 text-center py-6 px-4 italic">
            No series created yet. Start by defining a historical topic!
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={onOpenSettings}
          className="w-full py-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center gap-3 transition-colors text-sm font-medium"
        >
          <Settings className="w-4 h-4" />
          Settings (API Key)
        </button>
      </div>
    </div>
  );
};

const SeriesMenuItem: React.FC<{ seriesId: string; title: string }> = ({ seriesId, title }) => {
  const { activeSeries, activeEpisode, setActiveSeriesId, setActiveEpisodeId } = useSeries();
  const isActive = activeSeries?.id === seriesId;
  
  // Load episodes for this series
  const episodes = useLiveQuery(() => db.episodes.where({ seriesId }).toArray()) || [];

  return (
    <div className="mb-2">
      <button
        onClick={() => {
          setActiveSeriesId(seriesId);
          setActiveEpisodeId(null);
        }}
        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
          isActive && !activeEpisode ? 'bg-slate-800 text-amber-500' : 'hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className="truncate">{title}</div>
      </button>

      {/* Episodes nested list */}
      {isActive && episodes.length > 0 && (
        <div className="ml-4 mt-1 border-l border-slate-700 pl-2 space-y-1">
          {episodes.map(ep => (
            <button
              key={ep.id}
              onClick={() => setActiveEpisodeId(ep.id)}
              className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2 truncate ${
                activeEpisode?.id === ep.id ? 'bg-slate-800/80 text-amber-400 font-bold' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
              }`}
            >
              <Film className="w-3 h-3 shrink-0" />
              <span className="truncate">{ep.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
