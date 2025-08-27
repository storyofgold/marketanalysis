import React, { useState, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { SymbolConfig, Annotation, BoundingBox } from '../types';
import { jsPDF } from 'jspdf';

interface AnalysisData {
  symbol: SymbolConfig | null;
  analysis: string;
}

interface TechnicalAnalysisData extends AnalysisData {
  type: string;
  chartImage: string | null;
  annotations: Annotation[] | null;
  boundingBox: BoundingBox | null;
}

interface SummarizeAnalysisProps {
  fundamentalAnalysisData: AnalysisData;
  technicalAnalysisData: TechnicalAnalysisData;
}

const SummarizeAnalysis: React.FC<SummarizeAnalysisProps> = ({
  fundamentalAnalysisData,
  technicalAnalysisData,
}) => {
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const canSummarize =
    fundamentalAnalysisData.symbol &&
    technicalAnalysisData.symbol &&
    fundamentalAnalysisData.symbol.symbol === technicalAnalysisData.symbol.symbol &&
    fundamentalAnalysisData.analysis !== '' &&
    technicalAnalysisData.analysis !== '';

  const generateSummary = useCallback(async () => {
    if (!canSummarize) {
      setError('Pastikan analisis fundamental dan teknikal telah dibuat untuk pair yang sama.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSummary('');

    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
      const dateTimeWIB = new Date().toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB';

      const analysisPrompt = `
You are a professional hedge fund analyst providing a trade thesis.

**Fundamental Analysis:**
---
${fundamentalAnalysisData.analysis}
---

**Technical Analysis (${technicalAnalysisData.type}):**
---
${technicalAnalysisData.analysis}
---

Based on your combined analysis for ${fundamentalAnalysisData.symbol!.description}, provide the following in a clear, structured format:

1.  **Summary & Correlation:** A brief summary that connects the key points from both the fundamental and technical analyses.
2.  **Market Bias:** State your conclusion clearly: are you focusing on **BUY**, **SELL**, or are you **NEUTRAL**?
3.  **Key Rationale:** Provide the single most important reason for your stated market bias. For a neutral stance, explain what key factor you are waiting for (e.g., NFP data release).
4.  **Trade Execution Plan:**
    *   **Action:** (e.g., Buy Limit, Sell Stop)
    *   **Entry Price:** [Specify a clear price level]
    *   **Stop Loss (SL):** [Specify a clear price level]
    *   **Take Profit (TP):** [Specify a clear price level]
    *   **Risk/Reward Ratio:** [Calculate and state the ratio]
5.  **Reasoning for Levels:**
    *   **Entry Reason:** Explain why you chose this specific entry point based on technical levels or market structure.
    *   **SL Reason:** Explain the logic for placing the stop loss.
    *   **TP Reason:** Explain why the take profit is set at that level.
6.  **Technical Analysis Key Points:** Re-state the "**Key Points:**" section from the provided technical analysis verbatim. Do not change it.

**IMPORTANT CONSTRAINTS:**
- The Risk/Reward ratio for the trade plan **must be at least 1:2**.
- The analysis must be professional, concise, and actionable.
`;
      
      const analysisResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: analysisPrompt,
      });

      const englishSummary = analysisResponse.text;
      if (!englishSummary) {
        throw new Error('Summary generation returned empty.');
      }
      
      const translationPrompt = `Translate the following financial analysis into professional and accurate Indonesian. IMPORTANT: Do not translate specific trading and financial terms. Keep terms like indicator names (e.g., RSI, MACD, Moving Average), Wyckoff methodology terms (e.g., accumulation, distribution, spring, upthrust, Phase A, B, C, D, E), and other specific trading jargon (e.g., volume, Point of Control, Value Area, Buy Limit, Sell Stop, Stop Loss, Take Profit, Key Points) in their original English form.\n\n${englishSummary}`;
      const translationResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: translationPrompt,
      });

      const translatedSummary = `**${dateTimeWIB}**\n\n${translationResponse.text}`;
      setSummary(translatedSummary);
    } catch (e) {
      console.error(e);
      setError('Gagal membuat ringkasan. Silakan periksa konsol untuk detailnya.');
    } finally {
      setIsLoading(false);
    }
  }, [canSummarize, fundamentalAnalysisData, technicalAnalysisData]);
  
  const handlePrint = async () => {
    if (!summary || !technicalAnalysisData.chartImage) {
        setError("Ringkasan atau gambar chart tidak tersedia untuk dicetak.");
        return;
    }

    try {
        const getAnnotatedImage = (): Promise<string> => {
            return new Promise((resolve, reject) => {
                const { chartImage, annotations, boundingBox } = technicalAnalysisData;
                if (!chartImage) {
                    return reject(new Error("Chart image is missing."));
                }
                
                const baseImage = new Image();
                baseImage.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = baseImage.width;
                    canvas.height = baseImage.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject(new Error("Could not get canvas context."));

                    // 1. Draw the base chart image
                    ctx.drawImage(baseImage, 0, 0);

                    // If no annotations or bounding box, return the plain image
                    if (!annotations || annotations.length === 0 || !boundingBox) {
                      return resolve(canvas.toDataURL('image/png'));
                    }

                    // 2. Prepare SVG overlay with transformed annotations
                    const svgAnnotations = annotations.map(anno => {
                        if (anno.type === 'line') {
                            return `<line x1="${anno.x1}" y1="${anno.y1}" x2="${anno.x2}" y2="${anno.y2}" stroke="${anno.color || '#ffffff'}" stroke-width="${(anno.strokeWidth || 0.2) * 2}" />`;
                        }
                        if (anno.type === 'rect') {
                            return `<rect x="${anno.x}" y="${anno.y}" width="${anno.width}" height="${anno.height}" fill="${anno.color || '#ffffff'}" fill-opacity="${anno.fillOpacity || 0.1}" />`;
                        }
                        if (anno.type === 'text') {
                             const fontSize = (anno.fontSize || 2.5); // Use 2.5 as a robust default size
                             return `<text x="${anno.x}" y="${anno.y}" fill="${anno.color || '#ffffff'}" font-size="${fontSize}" font-family="sans-serif" font-weight="bold" paint-order="stroke" stroke="rgba(0,0,0,0.8)" stroke-width="0.3" dominant-baseline="middle" text-anchor="middle">${anno.text}</text>`;
                        }
                        return '';
                    }).join('');

                    const gTransform = `transform="translate(${boundingBox.x}, ${boundingBox.y}) scale(${boundingBox.width / 100}, ${boundingBox.height / 100})"`;
                    const svgGroup = `<g ${gTransform}>${svgAnnotations}</g>`;
                    
                    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${baseImage.width}" height="${baseImage.height}" viewBox="0 0 100 100" preserveAspectRatio="none">${svgGroup}</svg>`;
                    const svgDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgString)));

                    // 3. Draw the SVG overlay onto the canvas
                    const svgImage = new Image();
                    svgImage.onload = () => {
                        ctx.drawImage(svgImage, 0, 0);
                        resolve(canvas.toDataURL('image/png'));
                    };
                    svgImage.onerror = (err) => reject(err);
                    svgImage.src = svgDataUrl;
                };
                baseImage.onerror = (err) => reject(err);
                baseImage.src = chartImage;
            });
        };

        const pdf = new jsPDF('p', 'mm', 'a4');
        const filename = `Trade_Summary_${fundamentalAnalysisData.symbol?.symbol}_${new Date().toISOString().split('T')[0]}.pdf`;

        const pageHeight = pdf.internal.pageSize.getHeight();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);
        let currentY = margin;

        const addPageIfNeeded = (spaceNeeded: number) => {
            if (currentY + spaceNeeded > pageHeight - margin) {
                pdf.addPage();
                currentY = margin;
            }
        };

        // --- PDF Header ---
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.text('Summarize & Trade Plan', margin, currentY);
        currentY += 15;

        // --- Original Chart Image ---
        pdf.setFontSize(12);
        pdf.text('Original Chart', margin, currentY);
        currentY += 8;
        try {
            const originalImgProps = pdf.getImageProperties(technicalAnalysisData.chartImage!);
            const originalImgHeight = (originalImgProps.height * contentWidth) / originalImgProps.width;
            addPageIfNeeded(originalImgHeight);
            pdf.addImage(technicalAnalysisData.chartImage!, 'PNG', margin, currentY, contentWidth, originalImgHeight);
            currentY += originalImgHeight + 10;
        } catch (imgError) {
            console.error("Error adding original chart image to PDF:", imgError);
            addPageIfNeeded(10);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(255, 0, 0);
            pdf.text('Gagal memuat gambar grafik original.', margin, currentY);
            pdf.setTextColor(0, 0, 0);
            currentY += 10;
        }

        // --- Annotated Chart Image ---
        addPageIfNeeded(20); // Add some space
        pdf.setFontSize(12);
        pdf.text('Annotated Chart for Analysis', margin, currentY);
        currentY += 8;
        try {
            const annotatedImage = await getAnnotatedImage();
            const imgProps = pdf.getImageProperties(annotatedImage);
            const imgHeight = (imgProps.height * contentWidth) / imgProps.width;
            addPageIfNeeded(imgHeight);
            pdf.addImage(annotatedImage, 'PNG', margin, currentY, contentWidth, imgHeight);
            currentY += imgHeight + 10;
        } catch (imgError) {
            console.error("Error adding chart image to PDF:", imgError);
            addPageIfNeeded(10);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(255, 0, 0); // Red color for error
            pdf.text('Gagal memuat gambar grafik anotasi.', margin, currentY);
            pdf.setTextColor(0, 0, 0); // Reset color
            currentY += 10;
        }

        // --- Summary Text ---
        addPageIfNeeded(15); // Space for header
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('Correlated Summary & Conclusion', margin, currentY);
        currentY += 8;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        const plainSummary = summary.replace(/\*\*(.*?)\*\*/g, '$1');
        const lines = pdf.splitTextToSize(plainSummary, contentWidth);
        const lineHeight = 5; // Height for 9pt font

        lines.forEach((line: string) => {
            addPageIfNeeded(lineHeight);
            pdf.text(line, margin, currentY);
            currentY += lineHeight;
        });

        // --- Save the PDF ---
        pdf.save(filename);

    } catch (err) {
        console.error("Failed to generate PDF", err);
        setError("Gagal membuat PDF. Silakan coba lagi.");
    }
  };


  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <h2 className="text-xl font-bold">Summarize & Trade Plan</h2>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={generateSummary}
              disabled={!canSummarize || isLoading}
              className="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors w-full sm:w-auto"
            >
              {isLoading ? 'Menyimpulkan...' : 'Buat Ringkasan'}
            </button>
            <button
                onClick={handlePrint}
                disabled={!summary || !technicalAnalysisData.chartImage}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors flex items-center gap-2"
                aria-label="Print summary to PDF"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm2-9V5a2 2 0 012-2h2a2 2 0 012 2v3m-4 9v-4m0 4H9m6 0h2" />
                </svg>
                <span>Print</span>
            </button>
        </div>
      </div>
      <div className="bg-gray-900 rounded p-3 min-h-[200px] text-gray-300 whitespace-pre-wrap overflow-y-auto">
        {isLoading && <p className="text-center animate-pulse">Gemini sedang mengkorelasikan data...</p>}
        {!isLoading && error && <p className="text-red-400 text-center">{error}</p>}
        {!isLoading && !error && !summary && (
          <div className="text-center text-gray-500 flex flex-col items-center justify-center h-full">
            <p className='mb-2'>Silakan selesaikan analisis fundamental dan teknikal untuk pair yang sama.</p>
            <div className="bg-gray-700 p-3 rounded-md text-left">
                <p className="text-sm font-bold mb-1">Status:</p>
                <ul className="text-sm list-disc list-inside">
                  <li className={fundamentalAnalysisData.analysis ? 'text-green-400' : 'text-yellow-400'}>
                    Analisis Fundamental: {fundamentalAnalysisData.analysis ? `Selesai (${fundamentalAnalysisData.symbol?.symbol})` : 'Belum ada'}
                  </li>
                  <li className={technicalAnalysisData.analysis ? 'text-green-400' : 'text-yellow-400'}>
                    Analisis Teknikal: {technicalAnalysisData.analysis ? `Selesai (${technicalAnalysisData.symbol?.symbol})` : 'Belum ada'}
                  </li>
                  <li className={canSummarize ? 'text-green-400' : 'text-yellow-400'}>
                    Pair Cocok: {canSummarize ? 'Ya' : 'Tidak'}
                  </li>
                </ul>
            </div>
          </div>
        )}
        {!isLoading && !error && summary && <p>{summary}</p>}
      </div>
    </div>
  );
};

export default SummarizeAnalysis;