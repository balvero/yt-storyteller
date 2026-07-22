import Dexie, { type EntityTable } from 'dexie';
import { Series, Episode } from './types';

const db = new Dexie('YouTubeShortsStorytellerDB') as Dexie & {
  series: EntityTable<
    Series,
    'id' // primary key "id" (for the typings only)
  >;
  episodes: EntityTable<
    Episode,
    'id'
  >;
};

// Schema declaration:
db.version(1).stores({
  series: 'id, title, createdAt', // primary key and indexed props
  episodes: 'id, seriesId, title, createdAt' // Primary key and indexed props
});

export { db };
