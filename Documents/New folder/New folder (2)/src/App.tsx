import React, { useState } from 'react';
import TradingViewWidget from './components/TradingViewWidget';
import FundamentalAnalysis from './components/FundamentalAnalysis';
import TechnicalAnalysis from './components/TechnicalAnalysis';
import SummarizeAnalysis from './components/SummarizeAnalysis';
import { ALL_SYMBOLS, DEFAULT_CHARTS } from './constants';
import type { SymbolConfig, Annotation, BoundingBox } from './types';

interface TechnicalAnalysisState {
  symbol: SymbolConfig | null;
  analysis: string;
  type: string;
  chartImage: string | null;
  annotations: Annotation[] | null;
  boundingBox: BoundingBox | null;
}

const App: React.FC = () => {
  const [charts, setCharts] = useState<SymbolConfig[]>(DEFAULT_CHARTS);
  const [fundamentalAnalysisData, setFundamentalAnalysisData] = useState<{ symbol: SymbolConfig | null; analysis: string }>({ symbol: null, analysis: '' });
  const [technicalAnalysisData, setTechnicalAnalysisData] = useState<TechnicalAnalysisState>({ symbol: null, analysis: '', type: '', chartImage: null, annotations: null, boundingBox: null });

  const handleSymbolChange = (chartIndex: number, newSymbolProvider: string) => {
    const [provider, symbol] = newSymbolProvider.split(':');
    const newSymbolConfig = ALL_SYMBOLS.find(
      (s) => s.symbol === symbol && s.provider === provider
    );

    if (newSymbolConfig) {
      const newCharts = [...charts];
      newCharts[chartIndex] = newSymbolConfig;
      setCharts(newCharts);
    }
  };

  const handleFundamentalAnalysisUpdate = (data: { symbol: SymbolConfig; analysis: string }) => {
    setFundamentalAnalysisData(data);
  };

  const handleTechnicalAnalysisUpdate = (data: TechnicalAnalysisState) => {
    setTechnicalAnalysisData(data);
  };


  return (
    <div className="min-h-screen font-sans">
      {/* Header with a fixed height for predictable layout calculation */}
      <header className="text-center py-4 border-b border-gray-700 flex-shrink-0 sticky top-0 bg-gray-900 z-10 flex flex-col justify-center h-24">
        <h1 className="text-3xl font-bold text-teal-400">Multichart Analysis</h1>
        <p className="text-md text-gray-400">with Story of Gold</p>
      </header>
      
      {/* Charts container that fills the viewport height minus the header */}
      <main className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2 md:p-4 h-[calc(100vh-6rem)]">
        {charts.map((chart, index) => (
          // Each chart container now takes the full height of its grid cell
          <div key={index} className="flex flex-col bg-gray-800 rounded-lg border border-gray-700 h-full">
            <div className="p-2 border-b border-gray-700">
              <select
                value={`${chart.provider}:${chart.symbol}`}
                onChange={(e) => handleSymbolChange(index, e.target.value)}
                className="bg-gray-700 text-white w-full p-1 rounded focus:outline-none"
                aria-label={`Select symbol for chart ${index + 1}`}
              >
                {ALL_SYMBOLS.map((s) => (
                  <option key={`${s.provider}:${s.symbol}`} value={`${s.provider}:${s.symbol}`}>
                    {s.description}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-grow">
              <TradingViewWidget symbol={`${chart.provider}:${chart.symbol}`} />
            </div>
          </div>
        ))}
      </main>

      {/* Analysis sections are placed after the main charts view, accessible via scrolling */}
      <div className="flex flex-col gap-4 p-2 md:p-4 mt-4">
        <FundamentalAnalysis onAnalysisUpdate={handleFundamentalAnalysisUpdate} />
        <TechnicalAnalysis onAnalysisUpdate={handleTechnicalAnalysisUpdate} />
        <SummarizeAnalysis 
          fundamentalAnalysisData={fundamentalAnalysisData}
          technicalAnalysisData={technicalAnalysisData}
        />
      </div>
    </div>
  );
};

export default App;