
import { ETF, Influencer } from "../frontend/types";
import { TRACKED_ETFS, INFLUENCERS } from "../frontend/constants";

/**
 * MOCK SERVER DATABASE
 * W rzeczywistej aplikacji te dane byłyby zapisywane w MongoDB/PostgreSQL.
 * Na potrzeby środowiska preview, dane są przechowywane w pamięci "serwera".
 */

let serverEtfs: ETF[] = [...TRACKED_ETFS];
let serverInfluencers: Influencer[] = [...INFLUENCERS];

export const getEtfsOnServer = async (userId: string = 'guest'): Promise<ETF[]> => {
  // Symulacja opóźnienia sieciowego
  await new Promise(resolve => setTimeout(resolve, 300));
  return serverEtfs;
};

export const saveEtfOnServer = async (etf: ETF, userId: string = 'guest'): Promise<void> => {
  if (!serverEtfs.find(e => e.ticker === etf.ticker)) {
    serverEtfs.push(etf);
  }
};

export const deleteEtfOnServer = async (ticker: string, userId: string = 'guest'): Promise<void> => {
  serverEtfs = serverEtfs.filter(e => e.ticker !== ticker);
};

export const getInfluencersOnServer = async (userId: string = 'guest'): Promise<Influencer[]> => {
  return serverInfluencers;
};

export const saveInfluencerOnServer = async (influencer: Influencer, userId: string = 'guest'): Promise<void> => {
  if (!serverInfluencers.find(i => i.handle === influencer.handle)) {
    serverInfluencers.push(influencer);
  }
};

export const deleteInfluencerOnServer = async (handle: string, userId: string = 'guest'): Promise<void> => {
  serverInfluencers = serverInfluencers.filter(i => i.handle !== handle);
};

export const resetInfluencersOnServer = async (userId: string = 'guest'): Promise<Influencer[]> => {
  serverInfluencers = [...INFLUENCERS];
  return serverInfluencers;
};
