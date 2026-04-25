import { ETF, Influencer } from './types';
import { TRACKED_ETFS, DEFAULT_INFLUENCERS } from './constants';

/**
 * MOCK SERVER DATABASE
 * W produkcji dane byłyby zapisywane w MongoDB/PostgreSQL.
 * Na potrzeby środowiska lokalnego, dane przechowywane są w pamięci procesu.
 */

let serverEtfs: ETF[] = [...TRACKED_ETFS];
let serverInfluencers: Influencer[] = [...DEFAULT_INFLUENCERS];

export const getEtfsOnServer = async (): Promise<ETF[]> => {
  await new Promise((resolve) => setTimeout(resolve, 50)); // symulacja latency
  return serverEtfs;
};

export const saveEtfOnServer = async (etf: ETF): Promise<void> => {
  if (!serverEtfs.find((e) => e.ticker === etf.ticker)) {
    serverEtfs.push(etf);
  }
};

export const deleteEtfOnServer = async (ticker: string): Promise<void> => {
  serverEtfs = serverEtfs.filter((e) => e.ticker !== ticker);
};

export const getInfluencersOnServer = async (): Promise<Influencer[]> => {
  return serverInfluencers;
};

export const saveInfluencerOnServer = async (influencer: Influencer): Promise<void> => {
  if (!serverInfluencers.find((i) => i.handle === influencer.handle)) {
    serverInfluencers.push(influencer);
  }
};

export const deleteInfluencerOnServer = async (handle: string): Promise<void> => {
  serverInfluencers = serverInfluencers.filter((i) => i.handle !== handle);
};

export const resetInfluencersOnServer = async (): Promise<Influencer[]> => {
  serverInfluencers = [...DEFAULT_INFLUENCERS];
  return serverInfluencers;
};
