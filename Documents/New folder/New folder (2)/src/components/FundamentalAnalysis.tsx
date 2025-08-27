import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { ALL_SYMBOLS } from '../constants';
import type { SymbolConfig } from '../types';

interface FundamentalAnalysisProps {
  onAnalysisUpdate: (data: { symbol: SymbolConfig; analysis: string }) => void;
}

const FundamentalAnalysis: React.FC<FundamentalAnalysisProps> = ({ onAnalysisUpdate }) => {
  const [selectedPair, setSelectedPair] = useState<SymbolConfig | null>(null);
  const [analysisCache, setAnalysisCache] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async (pairToAnalyze: SymbolConfig) => {
    setIsLoading(true);
    setError(null);

    const today = new Date();
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });

    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
      
      // Step 1: Get analysis in English for best quality
      const analysisPrompt = `
You are an expert financial market analyst.
Provide a **daily summary** for the trading pair: ${pairToAnalyze.description} (${pairToAnalyze.symbol}).
Today's date is ${today.toDateString()}.

⚠️ Important Instructions:
- Only include **fundamental news and events that are current as of today** or within the last 24–48 hours.
- Do NOT mention outdated or historical news unless it is still explicitly impacting today's market.
- Always reference **specific economic indicators, central bank policy updates, geopolitical developments, or major market-moving headlines** that are relevant right now.
- If there are no significant new events, clearly state: *"No major fresh news in the past 24 hours; the pair is mainly influenced by ongoing factors such as [X, Y, Z]."*

Output Format:
- Write in clear, concise paragraphs.
- Begin with the **most impactful news** first.
- Keep the analysis focused on **today's relevance**.`;
      
      const analysisResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: analysisPrompt,
      });

      const englishAnalysis = analysisResponse.text;
      if (!englishAnalysis) {
        throw new Error('Analysis generation returned empty.');
      }

      // Step 2: Translate the English analysis to Indonesian, keeping technical terms in English.
      const translationPrompt = `Translate the following financial analysis into professional and accurate Indonesian. IMPORTANT: Do not translate specific trading and financial terms. Keep terms like indicator names (e.g., RSI, MACD, Moving Average), Wyckoff methodology terms (e.g., accumulation, distribution, spring, upthrust, Phase A, B, C, D, E), and other specific trading jargon (e.g., volume, Point of Control, Value Area) in their original English form.\n\n${englishAnalysis}`;
      const translationResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: translationPrompt,
      });

      const translatedAnalysis = translationResponse.text;

      setAnalysisCache(prevCache => ({
        ...prevCache,
        [pairToAnalyze.symbol]: translatedAnalysis,
      }));

      onAnalysisUpdate({ symbol: pairToAnalyze, analysis: translatedAnalysis });

    } catch (e) {
      console.error(e);
      setError('Gagal mengambil analisis. Silakan periksa konsol untuk detailnya.');
    } finally {
      setIsLoading(false);
    }
  }, [onAnalysisUpdate]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [provider, symbol] = e.target.value.split(':');
    const newSelectedPair = ALL_SYMBOLS.find(
      (s) => s.symbol === symbol && s.provider === provider
    ) || null;
    
    setSelectedPair(newSelectedPair);

    if (newSelectedPair && !analysisCache[newSelectedPair.symbol]) {
      fetchAnalysis(newSelectedPair);
    }
  };

  const handleRefresh = () => {
    if (isLoading) return;
    if (selectedPair) {
      fetchAnalysis(selectedPair);
    }
  };

  const currentAnalysis = selectedPair ? analysisCache[selectedPair.symbol] : null;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 1V1a1 1 0 00-1-1H9a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1zM3 17h18M12 6h8m-8 4h8m-8 4h8" />
            </svg>
            <h2 className="text-xl font-bold">Fundamental Analysis</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            onChange={handleSelectChange}
            defaultValue=""
            className="bg-gray-700 text-white p-1 rounded focus:outline-none"
            aria-label="Select a pair for fundamental analysis"
          >
            <option value="" disabled>Pilih Pair...</option>
            {ALL_SYMBOLS.map((s) => (
              <option key={`${s.provider}:${s.symbol}`} value={`${s.provider}:${s.symbol}`}>
                {s.description}
              </option>
            ))}
          </select>
          {selectedPair && currentAnalysis && (
             <button onClick={handleRefresh} disabled={isLoading} className="p-1.5 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50" aria-label="Refresh analysis">
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                   <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 4l5 5M20 20l-5-5" />
                   <path strokeLinecap="round" strokeLinejoin="round" d="M20.944 12.944A8.992 8.992 0 0012 4.002a8.992 8.992 0 00-8.944 8.942m17.888 0A8.992 8.992 0 0112 20.002a8.992 8.992 0 01-8.944-8.942" />
                </svg>
            </button>
          )}
        </div>
      </div>
      <div className="bg-gray-900 rounded p-3 min-h-[150px] text-gray-300 whitespace-pre-wrap overflow-y-auto">
        {isLoading && <p className="text-center animate-pulse">Menganalisis dengan Gemini...</p>}
        {!isLoading && error && <p className="text-red-400 text-center">{error}</p>}
        {!isLoading && !error && !selectedPair && <p className="text-center text-gray-500">Silakan pilih pair untuk dianalisis.</p>}
        {!isLoading && !error && selectedPair && currentAnalysis && <p>{currentAnalysis}</p>}
      </div>
    </div>
  );
};

export default FundamentalAnalysis;