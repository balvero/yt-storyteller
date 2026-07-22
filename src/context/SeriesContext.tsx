import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Series, Episode, AppSettings } from '../types';

interface SeriesContextType {
  allSeries: Series[];
  activeSeries: Series | null;
  activeEpisode: Episode | null;
  settings: AppSettings;
  setActiveSeriesId: (id: string | null) => void;
  setActiveEpisodeId: (id: string | null) => void;
  createSeries: (series: Omit<Series, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateSeries: (id: string, updates: Partial<Series>) => Promise<void>;
  deleteSeries: (id: string) => Promise<void>;
  createEpisode: (episode: Omit<Episode, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateEpisode: (id: string, updates: Partial<Episode>) => Promise<void>;
  deleteEpisode: (id: string) => Promise<void>;
  renumberSeriesEpisodes: (seriesId: string) => Promise<void>;
  updateSettings: (updates: Partial<AppSettings>) => void;
}

const SeriesContext = createContext<SeriesContextType | undefined>(undefined);

const defaultSettings: AppSettings = {
  geminiApiKey: '',
  modelName: 'gemini-3.6-flash',
  voiceoverLanguage: 'English',
  aspectRatio: '9:16'
};

export const SeriesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeSeriesId, setActiveSeriesId] = useState<string | null>(null);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('ytss_settings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('ytss_settings', JSON.stringify(settings));
  }, [settings]);

  const allSeries = useLiveQuery(() => db.series.orderBy('createdAt').reverse().toArray()) || [];
  
  // Use useLiveQuery for active objects so they update automatically when DB changes
  const activeSeries = (useLiveQuery(
    () => activeSeriesId ? db.series.get(activeSeriesId) : Promise.resolve(null),
    [activeSeriesId]
  ) as Series | undefined) || null;

  const activeEpisode = (useLiveQuery(
    () => activeEpisodeId ? db.episodes.get(activeEpisodeId) : Promise.resolve(null),
    [activeEpisodeId]
  ) as Episode | undefined) || null;

  // Auto-select first series if none active
  useEffect(() => {
    if (!activeSeriesId && allSeries.length > 0) {
      setActiveSeriesId(allSeries[0].id);
    }
  }, [allSeries, activeSeriesId]);

  const createSeries = async (series: Omit<Series, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = `series-${Date.now()}`;
    const now = new Date().toISOString();
    await db.series.add({ ...series, id, createdAt: now, updatedAt: now });
    setActiveSeriesId(id);
    return id;
  };

  const updateSeries = async (id: string, updates: Partial<Series>) => {
    await db.series.update(id, { ...updates, updatedAt: new Date().toISOString() });
  };

  const deleteSeries = async (id: string) => {
    await db.series.delete(id);
    // Delete cascade
    const epIds = await db.episodes.where({ seriesId: id }).primaryKeys();
    await db.episodes.bulkDelete(epIds);
    if (activeSeriesId === id) setActiveSeriesId(null);
  };

  const createEpisode = async (episode: Omit<Episode, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = `ep-${Date.now()}`;
    const now = new Date().toISOString();
    await db.episodes.add({ ...episode, id, createdAt: now, updatedAt: now });
    setActiveEpisodeId(id);
    return id;
  };

  const updateEpisode = async (id: string, updates: Partial<Episode>) => {
    await db.episodes.update(id, { ...updates, updatedAt: new Date().toISOString() });
  };

  const deleteEpisode = async (id: string) => {
    const ep = await db.episodes.get(id);
    const seriesId = ep?.seriesId;
    await db.episodes.delete(id);
    if (activeEpisodeId === id) setActiveEpisodeId(null);
    if (seriesId) {
      await renumberSeriesEpisodes(seriesId);
    }
  };

  const renumberSeriesEpisodes = async (seriesId: string) => {
    const eps = await db.episodes.where({ seriesId }).sortBy('createdAt');
    for (let i = 0; i < eps.length; i++) {
      const ep = eps[i];
      const coreTitle = ep.title.replace(/^Episode\s*\d+:\s*/i, '').trim();
      const newTitle = `Episode ${i + 1}: ${coreTitle}`;
      if (ep.title !== newTitle) {
        await db.episodes.update(ep.id, { title: newTitle, updatedAt: new Date().toISOString() });
      }
    }
  };

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  return (
    <SeriesContext.Provider value={{
      allSeries,
      activeSeries,
      activeEpisode,
      settings,
      setActiveSeriesId,
      setActiveEpisodeId,
      createSeries,
      updateSeries,
      deleteSeries,
      createEpisode,
      updateEpisode,
      deleteEpisode,
      renumberSeriesEpisodes,
      updateSettings
    }}>
      {children}
    </SeriesContext.Provider>
  );
};

export const useSeries = () => {
  const context = useContext(SeriesContext);
  if (context === undefined) throw new Error('useSeries must be used within SeriesProvider');
  return context;
};
