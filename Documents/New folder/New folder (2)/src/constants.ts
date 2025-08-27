import type { SymbolConfig } from './types';

// A comprehensive list of all available symbols for the dropdowns.
export const ALL_SYMBOLS: SymbolConfig[] = [
  { symbol: 'XAUUSD', provider: 'OANDA', description: 'Gold / US Dollar' },
  { symbol: 'SPX500USD', provider: 'OANDA', description: 'S&P 500' },
  { symbol: 'EURUSD', provider: 'OANDA', description: 'Euro / US Dollar' },
  { symbol: 'USDJPY', provider: 'OANDA', description: 'US Dollar / Japanese Yen' },
  { symbol: 'DXY', provider: 'CAPITALCOM', description: 'US Dollar Index' },
  { symbol: 'GBPUSD', provider: 'OANDA', description: 'Pound Sterling / US Dollar' },
];

// The initial configuration for the four charts when the app loads.
export const DEFAULT_CHARTS: SymbolConfig[] = [
  ALL_SYMBOLS[0], // XAUUSD
  ALL_SYMBOLS[1], // S&P 500
  ALL_SYMBOLS[2], // EURUSD
  ALL_SYMBOLS[3], // USDJPY
];
