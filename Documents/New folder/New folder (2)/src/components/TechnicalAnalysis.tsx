import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { ALL_SYMBOLS } from '../constants';
import type { SymbolConfig, Annotation, BoundingBox } from '../types';

// Helper function to convert a file to a base64 string
const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

const referenceInstruction = `You are an expert in the Wyckoff trading methodology. Your analysis must be based on the principles from the reference books and the structural analysis guide image provided to you.

**Reference Materials:**
1.  **Books (/public/):** You have studied and must base your analysis on the principles from the entire collection of Wyckoff methodology books provided in the /public/ folder. These books cover topics like in-depth Wyckoff analysis, modern structures, trade setups, and market psychology. Your analysis must be grounded in the core principles of the Wyckoff methodology as detailed in the provided reference materials. These materials cover the concepts found in seminal works which "The Wyckoff Methodology in Depth on classic studies on market schematics. You must synthesize the knowledge from this book.
2.  **Structural Guide Image (/public/struktur.png):** This image is your primary guide for identifying market structures. First, detect the smaller structures (accumulation/distribution) that may develop within short periods (e.g., range that developed in 1–2 days, balance on narrow ranges, and lower timeframes), mark them clearly (these smaller structures are typically shown with yellow text/labels and sometimes with light blue text/labels for even finer details). When identifying smaller/nested structures, only mark those with complete Wyckoff characteristics (AR, ST, BC/SC, etc.) and limit to the 1–2 most significant ranges. Do not label every minor fluctuation or isolated price swing. Then expand the view to connect and integrate these smaller structures into the larger, overarching structure (highlighted with green/red text/labels) on the higher timeframe. Your main task is to replicate this bottom-up analytical approach in detail.

Provide the analysis in professional Indonesian.`;

const annotationInstruction = `
**Output Format:**
First, provide your complete, detailed narrative analysis.

After your analysis, you MUST include a separator line:
--- ANNOTATIONS ---

Following this separator, provide a list of visual annotation instructions. **Each instruction MUST visually represent a specific item from your "Key Points:" list.** The annotations are the visual representation of your key findings.

**CRITICAL ANNOTATION INSTRUCTIONS:**

1.  **Fixed Plotting Area:** The images you receive are consistent. The main plotting area (where price action occurs) is a **fixed, pre-defined region**. We have already removed the chart's outer elements. The plotting area is defined by excluding the following from the *original* image dimensions:
    *   **Top:** Top 4% is excluded.
    *   **Bottom:** Bottom 20% is excluded.
    *   **Left:** Left 5.6% is excluded.
    *   **Right:** Right 0.4% is excluded.
    Your task is to place coordinates *within this specific plotting area*. Do not try to calculate this area yourself; assume it is fixed as described.

2.  **Map Analysis to Coordinates:** For each key point, level, or trend from your analysis, locate it visually and calculate its coordinates as percentages *relative to this fixed plotting area*.
    *   **X-Coordinate (Time):** The left edge of the plotting area is x=0. The right edge is x=100.
    *   **Y-Coordinate (Price):** The **top** edge of the plotting area is y=0. The **bottom** edge is y=100. (Note: This is a top-left origin system, matching SVG standards).

3.  **Generate Instructions:** Output ONLY a list of annotation instructions in the specified format. Do not include explanations. Do NOT output a BOUNDING_BOX.

4.  **Keep Text Labels Clean:** For \`TEXT\` annotations, the \`text\` value should be concise (e.g., "BC", "AR", "Support", "SOS"). **DO NOT include price values in the text labels.**

5.  **Strategic Label Placement:** When placing a TEXT label for a specific point (like a peak or trough), place the label slightly above or below the point for clarity, not directly on it. For horizontal lines or rectangles, place the text label near the line/rectangle.

**Coordinate System (for LINE, RECT, TEXT):** Top-left of the plotting area is (0,0). Bottom-right is (100,100).

**Available Formats:**
- LINE: x1=10.5, y1=20.0, x2=50.2, y2=20.8, color=#FF0000, strokeWidth=0.3
- RECT: x=10.0, y=15.5, width=40.0, height=20.0, color=#00FF00, fillOpacity=0.2
- TEXT: x=15.0, y=18.5, text="Label", color=#FFD600, fontSize=1.5
`;


const analysisPrompts = {
    pure: `You are an expert in the Wyckoff trading methodology. ${referenceInstruction}

**Analysis Task:**

**CRITICAL: Your response MUST follow this exact structure:**
1.  **Narrative Analysis:** Your detailed, structured narrative explaining the market's story according to Wyckoff principles. This is where you will perform the dual structure analysis.
2.  **Key Points Summary:** A mandatory section starting with the exact header "**Key Points:**". This section is non-negotiable and must contain a bulleted list summarizing every critical event, price level, and date you identified in your narrative. This is the primary summary for the user and for generating visual annotations.
3.  **Annotation Instructions:** A mandatory section starting with the exact separator "--- ANNOTATIONS ---".

Now, perform the analysis to generate the **Narrative Analysis** and **Key Points Summary**:
1.  **Establish Context: First, identify and state the visible price range (minimum and maximum price on the Y-axis) and the visible time range (start and end date/time on the X-axis) from the chart. This context is crucial for an accurate analysis. All subsequent analysis of price levels must fall within this identified range.
2.  **Bottom-Up Dual Structure Analysis (Based on /public/struktur.png): Your primary task is to replicate the analytical method shown in the structural guide image using a bottom-up approach. This involves identifying multiple, nested market structures.
    *  **Identify Smaller Structures First: Detect the smaller accumulation/distribution structures that may develop within short periods (e.g., range that developed in 1–2 days, balance on narrow ranges, and lower timeframes). These smaller structures are typically shown with yellow text/labels and sometimes with light blue text/labels for even finer nested details. Mark them clearly. When identifying smaller/nested structures, only mark those with complete Wyckoff characteristics (AR, ST, BC/SC, etc.) and limit to the most significant ranges. Do not label every minor fluctuation or isolated price swing.
    *  **Expand to the Major Structure: After identifying the smaller structures, expand the view to connect and integrate them into the larger, overarching structure visible on the higher timeframe. The major structures are typically highlighted with green/red text/labels (e.g., dominant accumulation or distribution phases that span weeks or months).
    *  **Volume-Aware Filtering: When performing Wyckoff analysis, you must use volume as the primary filter to distinguish between a developing major structure and a small trading range; if it’s only a minor trading range, mark it with a simple rectangle block without labels, while only valid dominant structures should receive full Wyckoff labeling (SC, AR, ST, BC, UT, SOW, LPSY, etc.).
    *  **Explain the Relationship: Your narrative MUST explain how the smaller (yellow/light blue) structures connect to and support the interpretation of the larger (green/red) structure, just as the guide image shows Range2 nested within Range1. For instance, a small distribution pattern might actually function as a re-accumulation inside the broader uptrend. This contextual analysis is critical.
3.  **Precise Event Identification:** For every key Wyckoff event or structural point you identify (e.g., Preliminary Support (PS), Buying Climax (BC), Automatic Rally (AR), Secondary Test (ST), Spring, Upthrust, Sign of Strength (SOS), Sign of Weakness (SOW), support/resistance lines, trading ranges), you MUST specify the exact price level and, if discernible from the chart, the date or time. Integrate the relationship between price action and volume (effort vs. result) with precision.
4.  **Populate Key Points:** Ensure every event identified in step 3 is listed in your "**Key Points:**" section with its price and date.
       **Example for "Key Points:":**
         - Selling Climax (SC) at price 6,260.0 on Aug 4
         - Automatic Rally (AR) resistance at price 6,380.0 on Aug 5
         - Secondary Test (ST) at price 6,270.0 on Aug 5-6
         - Spring (Phase C of TR1) at price 6,260.0 on Aug 9-10
         - Sign of Strength (SOS 1) breaks 6,380.0 on Aug 10-13, reaching 6,440.0
         - Buying Climax (BC) for TR2 at price 6,478.0 on Aug 15

${annotationInstruction}

Begin your full analysis now.`,
    indicators: `You are an expert technical analyst. ${referenceInstruction}

**Analysis Task:**

**CRITICAL: Your response MUST follow this exact structure:**
1.  **Narrative Analysis:** Your detailed, structured narrative that synthesizes indicator and Wyckoff analysis.
2.  **Key Points Summary:** A mandatory section starting with the exact header "**Key Points:**". This section is non-negotiable and must contain a bulleted list summarizing every critical event (from indicator signals, Wyckoff events, etc.), price level, and date you identified.
3.  **Annotation Instructions:** A mandatory section starting with the exact separator "--- ANNOTATIONS ---".

Now, perform the analysis to generate the **Narrative Analysis** and **Key Points Summary**:
1.  **Establish Context:** First, identify and state the visible price range (minimum and maximum price on the Y-axis) and the visible time range (start and end date/time on the X-axis) from the chart. This context is crucial for an accurate analysis.
2.  **Indicator Analysis:** Analyze the provided chart based on the visible technical indicators (e.g., moving averages, RSI, MACD, etc.). Describe what each indicator suggests about the market's momentum, trend, and potential reversal points.
3.  **Wyckoff & Price Action (Based on /public/):** Provide a detailed, structured narrative explaining the market's story according to Wyckoff principles found in the reference knowledge. Identify accumulation, distribution, or other patterns. Explain your reasoning step by step, applying the rules from the book. Do not assume information that is not in the reference.
4.  **Synthesize and Populate Key Points:** Synthesize the findings from your indicator analysis and Wyckoff analysis to give a comprehensive market outlook in your narrative. Ensure every critical event identified is listed in your "**Key Points:**" section with its price and date.
       **Example for "Key Points:":**
         - EMA 200 acting as dynamic support around 6,300
         - Selling Climax (SC) at price 6,260.0 on Aug 4
         - Automatic Rally (AR) resistance at price 6,380.0 on Aug 5
         - Sign of Strength (SOS 1) breaks resistance on Aug 10-13

${annotationInstruction}

Begin your full analysis now.`,
    profile: `You are an expert in Market Profile and Wyckoff analysis. ${referenceInstruction}

**Analysis Task:**

**CRITICAL: Your response MUST follow this exact structure:**
1.  **Narrative Analysis:** Your detailed, structured narrative that integrates Market Profile and Wyckoff analysis.
2.  **Key Points Summary:** A mandatory section starting with the exact header "**Key Points:**". This section is non-negotiable and must contain a bulleted list summarizing every critical event (from Market Profile levels, Wyckoff events, etc.), price level, and date you identified.
3.  **Annotation Instructions:** A mandatory section starting with the exact separator "--- ANNOTATIONS ---".

Now, perform the analysis to generate the **Narrative Analysis** and **Key Points Summary**:
1.  **Establish Context:** First, identify and state the visible price range (minimum and maximum price on the Y-axis) and the visible time range (start and end date/time on the X-axis) from the chart. This context is crucial for an accurate analysis.
2.  **Market Profile Analysis:** Analyze the provided Market Profile chart. Identify key structural elements such as the Point of Control (POC), Value Area (VA), and any significant profile shapes (e.g., P-shape, B-shape, bell curve). Discuss the implications of the current price relative to these levels, specifying price points.
3.  **Wyckoff & Price Action (Based on /public/):** Provide a detailed, structured narrative explaining the market's story according to Wyckoff principles found in the reference knowledge. Identify accumulation, distribution, or other patterns. Explain your reasoning step by step, applying the rules from the book. Do not assume information that is not in the reference.
4.  **Populate Key Points:** Ensure every critical event identified from both Market Profile and Wyckoff analysis is listed in your "**Key Points:**" section with its price and date.
        **Example for "Key Points:":**
         - Point of Control (POC) at 6,400
         - Value Area High (VAH) at 6,480
         - Selling Climax (SC) at price 6,260.0 on Aug 4
         - Spring event at price 6,050 on Aug 18

${annotationInstruction}

Begin your full analysis now.`,
};

const regenerationAnnotationInstruction = (keyPointsText: string) => `
You are a visual annotation assistant. Your task is to map the provided key points to coordinates on the chart image.
Based on the provided **Key Points**, generate ONLY a list of visual annotation instructions. Do not output any other text, narrative, explanation, or the "--- ANNOTATIONS ---" separator.

**Key Points to Annotate:**
---
${keyPointsText}
---

**CRITICAL ANNOTATION INSTRUCTIONS:**

1.  **Fixed Plotting Area:** The images you receive are consistent. The main plotting area (where price action occurs) is a **fixed, pre-defined region**. We have already removed the chart's outer elements. The plotting area is defined by excluding the following from the *original* image dimensions:
    *   **Top:** Top 4% is excluded.
    *   **Bottom:** Bottom 20% is excluded.
    *   **Left:** Left 5.6% is excluded.
    *   **Right:** Right 0.4% is excluded.
    Your task is to place coordinates *within this specific plotting area*. Do not try to calculate this area yourself; assume it is fixed as described.

2.  **Map Analysis to Coordinates:** For each key point, level, or trend from your analysis, locate it visually and calculate its coordinates as percentages *relative to this fixed plotting area*.
    *   **X-Coordinate (Time):** The left edge of the plotting area is x=0. The right edge is x=100.
    *   **Y-Coordinate (Price):** The **top** edge of the plotting area is y=0. The **bottom** edge is y=100. (Note: This is a top-left origin system, matching SVG standards).

3.  **Generate Instructions:** Output ONLY a list of annotation instructions in the specified format. Do not include explanations. Do NOT output a BOUNDING_BOX.

4.  **Keep Text Labels Clean:** For \`TEXT\` annotations, the \`text\` value should be concise (e.g., "BC", "AR", "Support", "SOS"). **DO NOT include price values in the text labels.**

5.  **Strategic Label Placement:** When placing a TEXT label for a specific point (like a peak or trough), place the label slightly above or below the point for clarity, not directly on it. For horizontal lines or rectangles, place the text label near the line/rectangle.

**Coordinate System (for LINE, RECT, TEXT):** Top-left of the plotting area is (0,0). Bottom-right is (100,100).

**Available Formats:**
- LINE: x1=10.5, y1=20.0, x2=50.2, y2=20.8, color=#FF0000, strokeWidth=0.3
- RECT: x=10.0, y=15.5, width=40.0, height=20.0, color=#00FF00, fillOpacity=0.2
- TEXT: x=15.0, y=18.5, text="Label", color=#FFD600, fontSize=1.5
`;

const analysisTypes = [
    { id: 'pure', title: 'Pure Chart' },
    { id: 'indicators', title: 'Chart with Indicators' },
    { id: 'profile', title: 'Market Profile' },
] as const;

type AnalysisTypeId = typeof analysisTypes[number]['id'];

// Fixed bounding box based on user-provided dimensions.
// Top: 4%, Bottom: 29%, Left: 5.6%, Right: 0.5%
const FIXED_BOUNDING_BOX: BoundingBox = {
    x: 4.0,
    y: 4.6,
    width: 100 - 5.6 - 0.4, // 94
    height: 100 - 4.0 - 20.0, // 76
};

interface TechnicalAnalysisProps {
  onAnalysisUpdate: (data: { 
    symbol: SymbolConfig; 
    analysis: string; 
    type: string; 
    chartImage: string | null; 
    annotations: Annotation[] | null;
    boundingBox: BoundingBox | null;
  }) => void;
}

/**
 * Parses a string of annotation instructions into an array of Annotation objects.
 */
const parseAnnotations = (text: string): Annotation[] => {
  if (!text) return [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const annotations: Annotation[] = [];

  for (const line of lines) {
    try {
        if (line.toUpperCase().startsWith("BOUNDING_BOX:")) {
            // Ignore bounding box lines from the model, if any are still sent.
            continue;
        } else if (line.toUpperCase().startsWith("LINE:")) {
            const match = /x1=([\d.]+).*y1=([\d.]+).*x2=([\d.]+).*y2=([\d.]+).*color=([^,]+).*strokeWidth=([\d.]+)/i.exec(line);
            if (match) {
            annotations.push({
                type: "line",
                x1: +match[1], y1: +match[2], x2: +match[3], y2: +match[4],
                color: match[5].trim(), strokeWidth: +match[6] || 0.3,
            });
            }
        } else if (line.toUpperCase().startsWith("RECT:")) {
            const match = /x=([\d.]+).*y=([\d.]+).*width=([\d.]+).*height=([\d.]+).*color=([^,]+).*fillOpacity=([\d.]+)/i.exec(line);
            if (match) {
            annotations.push({
                type: "rect",
                x: +match[1], y: +match[2], width: +match[3], height: +match[4],
                color: match[5].trim(), fillOpacity: +match[6] || 0.2,
            });
            }
        } else if (line.toUpperCase().startsWith("TEXT:")) {
            const match = /x=([\d.]+).*y=([\d.]+).*text=\"([^\"]+)\".*color=([^,]+).*fontSize=([\d.]+)/i.exec(line);
            if (match) {
            annotations.push({
                type: "text",
                x: +match[1], y: +match[2],
                text: match[3], color: match[4].trim(), fontSize: +match[5] || 1.5,
            });
            }
        }
    } catch (e) {
        console.error("Failed to parse annotation line:", line, e);
    }
  }
  return annotations;
};


const TechnicalAnalysis: React.FC<TechnicalAnalysisProps> = ({ onAnalysisUpdate }) => {
    const [selectedSymbol, setSelectedSymbol] = useState<SymbolConfig | null>(null);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
    const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
    const [activeAnalysisType, setActiveAnalysisType] = useState<AnalysisTypeId>('pure');
    const [analysis, setAnalysis] = useState<string>('');
    const [annotations, setAnnotations] = useState<Annotation[] | null>(null);
    const [boundingBox, setBoundingBox] = useState<BoundingBox | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [annotationKey, setAnnotationKey] = useState(0);
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    setImageAspectRatio(img.width / img.height);
                };
                img.src = e.target?.result as string;
                setImageDataUrl(e.target?.result as string);
            };
            reader.readAsDataURL(file);
            setAnalysis('');
            setAnnotations(null);
            setBoundingBox(null);
            setError(null);
        }
    };
    
    const handleSymbolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const [provider, symbol] = e.target.value.split(':');
        const newSelectedPair = ALL_SYMBOLS.find(
            (s) => s.symbol === symbol && s.provider === provider
        ) || null;
        setSelectedSymbol(newSelectedPair);
    };

    const handleAnalyze = async () => {
        if (!imageFile || !selectedSymbol) {
            setError('Silakan pilih pair dan unggah gambar grafik terlebih dahulu.');
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Gemini sedang menganalisis chart dan menyiapkan anotasi...');
        setError(null);
        setAnalysis('');
        setAnnotations(null);
        setBoundingBox(null);
        
        try {
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
            const imagePart = await fileToGenerativePart(imageFile);
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { text: analysisPrompts[activeAnalysisType] },
                        imagePart,
                    ],
                },
            });

            const fullResponseText = response.text;
            
            const separator = '--- ANNOTATIONS ---';
            const separatorIndex = fullResponseText.indexOf(separator);

            let generatedAnalysis = fullResponseText;
            let finalAnnotations: Annotation[] = [];
            
            if (separatorIndex !== -1) {
                generatedAnalysis = fullResponseText.substring(0, separatorIndex).trim();
                const rawAnnotationText = fullResponseText.substring(separatorIndex + separator.length).trim();
                finalAnnotations = parseAnnotations(rawAnnotationText);
            } else {
                 console.warn("Annotation separator not found in the response. Annotations will be empty.");
            }

            setAnalysis(generatedAnalysis);
            setAnnotations(finalAnnotations);
            setBoundingBox(FIXED_BOUNDING_BOX);
            setAnnotationKey(prev => prev + 1); // Ensure SVG re-renders with new annotations

            onAnalysisUpdate({
                symbol: selectedSymbol,
                analysis: generatedAnalysis,
                type: analysisTypes.find(t => t.id === activeAnalysisType)!.title,
                chartImage: imageDataUrl,
                annotations: finalAnnotations,
                boundingBox: FIXED_BOUNDING_BOX,
            });

        } catch (e) {
            console.error(e);
            setError('Gagal menganalisis gambar. Silakan periksa konsol untuk detailnya.');
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    };
    
    const handleRefreshAnnotations = async () => {
        if (isLoading || !analysis || !imageFile || !selectedSymbol) {
            setError('Data analisis tidak lengkap untuk meregenerasi anotasi.');
            return;
        }

        setIsLoading(true);
        setLoadingMessage('Gemini sedang meregenerasi koordinat anotasi...');
        setError(null);

        try {
            // Use a case-insensitive regex to find the "Key Points" section more robustly.
            // This will match "**Key Points:**", "Key Points:", "*Key Points:*", etc.
            const keyPointsRegex = /\*\*?Key Points:\*\*?/i;
            const match = analysis.match(keyPointsRegex);
            
            if (!match || typeof match.index === 'undefined') {
                throw new Error('Tidak dapat menemukan bagian "Key Points" di dalam analisis. Regenerasi tidak memungkinkan.');
            }

            const keyPointsText = analysis.substring(match.index);
            
            const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
            const imagePart = await fileToGenerativePart(imageFile);

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { text: regenerationAnnotationInstruction(keyPointsText) },
                        imagePart,
                    ],
                },
            });
            
            const rawAnnotationText = response.text;
            const newAnnotations = parseAnnotations(rawAnnotationText);

            if (newAnnotations.length === 0) {
                console.warn("Regeneration resulted in zero annotations.");
            }

            setAnnotations(newAnnotations);
            setAnnotationKey(prev => prev + 1);

            onAnalysisUpdate({
                symbol: selectedSymbol,
                analysis: analysis, // Keep old analysis
                type: analysisTypes.find(t => t.id === activeAnalysisType)!.title,
                chartImage: imageDataUrl,
                annotations: newAnnotations, // Use new annotations
                boundingBox: FIXED_BOUNDING_BOX,
            });

        } catch (e: any) {
            console.error(e);
            setError(e.message || 'Gagal meregenerasi anotasi. Silakan periksa konsol untuk detailnya.');
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    };

    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 sm:p-6 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                    </svg>
                    <h2 className="text-xl font-bold">Technical Analysis</h2>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-gray-900/50 p-3 rounded-lg">
                <select
                    onChange={handleSymbolChange}
                    defaultValue=""
                    className="bg-gray-700 text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                    aria-label="Select a pair for technical analysis"
                >
                    <option value="" disabled>Pilih Pair untuk Grafik...</option>
                    {ALL_SYMBOLS.map((s) => (
                        <option key={`${s.provider}:${s.symbol}`} value={`${s.provider}:${s.symbol}`}>
                            {s.description}
                        </option>
                    ))}
                </select>

                <div className="flex items-center gap-2">
                    <span className="text-gray-400">Pilih Tipe Analisis:</span>
                    <div className="flex items-center bg-gray-700 rounded-md p-0.5">
                        {analysisTypes.map(type => (
                            <button
                                key={type.id}
                                onClick={() => setActiveAnalysisType(type.id)}
                                className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${
                                    activeAnalysisType === type.id
                                        ? 'bg-teal-600 text-white'
                                        : 'text-gray-300 hover:bg-gray-600'
                                }`}
                            >
                                {type.title}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-gray-400">Upload:</span>
                    <label className="bg-gray-700 text-white px-3 py-2 rounded-md hover:bg-gray-600 cursor-pointer font-semibold transition-colors">
                        Select File
                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading || !imageFile || !selectedSymbol}
                        className="bg-teal-600 text-white px-4 py-2 rounded-md hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
                    >
                        {isLoading ? 'Menganalisis...' : 'Analisa Grafik'}
                    </button>
                    {analysis && (
                        <button
                            onClick={handleRefreshAnnotations}
                            disabled={isLoading}
                            className="p-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 transition-colors"
                            aria-label="Regenerate annotations from Key Points"
                            title="Regenerate annotations from Key Points"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                               <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 4l5 5M20 20l-5-5" />
                               <path strokeLinecap="round" strokeLinejoin="round" d="M20.944 12.944A8.992 8.992 0 0012 4.002a8.992 8.992 0 00-8.944 8.942m17.888 0A8.992 8.992 0 0112 20.002a8.992 8.992 0 01-8.944-8.942" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-gray-900 rounded-lg min-h-[400px] flex flex-col items-center justify-center p-4 gap-4">
                {isLoading && (
                    <div className="text-center">
                        <svg className="animate-spin h-8 w-8 text-teal-400 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <p className="text-lg font-semibold animate-pulse">{loadingMessage || 'Loading...'}</p>
                    </div>
                )}
                
                {!isLoading && error && (
                    <p className="text-red-400 text-center">{error}</p>
                )}

                {!isLoading && !error && !analysis && !imageDataUrl && (
                    <div className="text-center text-gray-500">
                        <p>Hasil analisis akan muncul di sini.</p>
                        <ol className="list-decimal list-inside mt-2">
                            <li>Pilih pair untuk dianalisis.</li>
                            <li>Unggah gambar grafik.</li>
                            <li>Tekan 'Analisa Grafik' untuk memulai.</li>
                        </ol>
                    </div>
                )}

                {!isLoading && !error && !analysis && imageDataUrl && (
                     <div
                        className="relative w-full flex-shrink-0"
                        style={imageAspectRatio ? { aspectRatio: imageAspectRatio } : {}}
                    >
                        <img src={imageDataUrl} alt="Chart preview" className="block rounded-lg object-cover w-full h-full" />
                         <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <p className="text-white text-lg font-bold bg-black/50 px-4 py-2 rounded">Preview. Ready to analyze.</p>
                        </div>
                    </div>
                )}

                {!isLoading && !error && analysis && (
                    <div className="w-full flex flex-col gap-6">
                        <div className="w-full">
                            {imageDataUrl && (
                                <div
                                  className="relative w-full"
                                  style={imageAspectRatio ? { aspectRatio: imageAspectRatio } : {}}
                                >
                                    <img src={imageDataUrl} alt="Analyzed chart" className="absolute top-0 left-0 w-full h-full block rounded-lg object-cover" />
                                    {annotations && boundingBox && (
                                        <svg key={annotationKey} className="absolute top-0 left-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                            <g transform={`translate(${boundingBox.x} ${boundingBox.y}) scale(${boundingBox.width / 100} ${boundingBox.height / 100})`}>
                                                {annotations.map((anno, index) => {
                                                    if (anno.type === 'line') {
                                                        return <line key={index} x1={anno.x1} y1={anno.y1} x2={anno.x2} y2={anno.y2} stroke={anno.color || '#ffffff'} strokeWidth={anno.strokeWidth} />;
                                                    }
                                                    if (anno.type === 'rect') {
                                                        return <rect key={index} x={anno.x} y={anno.y} width={anno.width} height={anno.height} fill={anno.color || '#ffffff'} fillOpacity={anno.fillOpacity} />;
                                                    }
                                                    if (anno.type === 'text') {
                                                        return <text
                                                            key={index}
                                                            x={anno.x}
                                                            y={anno.y}
                                                            fill={anno.color || '#ffffff'}
                                                            fontSize={anno.fontSize}
                                                            className="font-sans font-bold"
                                                            paintOrder="stroke"
                                                            stroke="rgba(0,0,0,0.8)"
                                                            strokeWidth="0.3"
                                                            textAnchor="middle"
                                                            dominantBaseline="middle"
                                                        >{anno.text}</text>;
                                                    }
                                                    return null;
                                                })}
                                            </g>
                                        </svg>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="w-full text-gray-300 whitespace-pre-wrap overflow-y-auto max-h-[600px] bg-gray-800 p-4 rounded-lg">
                            <p>{analysis}</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TechnicalAnalysis;