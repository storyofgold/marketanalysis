import React, { useEffect, useRef, memo, useId } from 'react';

declare global {
  interface Window {
    TradingView: any;
  }
}

interface TradingViewWidgetProps {
  symbol: string;
}

// Define colors as constants for readability and maintainability
const TEAL_COLOR = '#26A69A';

const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({ symbol }) => {
  const chartContainerId = `tradingview-widget-${useId()}`;
  const tvWidgetRef = useRef<any>(null);

  useEffect(() => {
    // This effect handles the entire widget lifecycle: creation and destruction.
    // It re-runs whenever the `symbol` prop changes.

    const createWidget = () => {
      if (document.getElementById(chartContainerId) && window.TradingView) {
        const widgetOptions = {
          autosize: true,
          symbol: symbol,
          interval: '30',
          timezone: 'Etc/UTC',
          theme: 'dark',
          style: '1',
          locale: 'en',
          enable_publishing: false,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          container_id: chartContainerId,
          study_name: false,
          study_arguments: false,
          ta_val: false,

          // Define the base indicator to load.
          studies: [
            {
              id: 'MAExp@tv-basicstudies',
              inputs: {
                length: 200,
                source: 'close',
              },
            },
          ],

        };
        
        // Create the new widget.
        tvWidgetRef.current = new window.TradingView.widget(widgetOptions);
      }
    };

    // Cleanup function: This runs before the effect runs again, and on unmount.
    if (tvWidgetRef.current && typeof tvWidgetRef.current.remove === 'function') {
      tvWidgetRef.current.remove();
      tvWidgetRef.current = null;
    }

    // Create the new widget using a poller to handle script loading.
    const intervalId = setInterval(() => {
      if (window.TradingView && typeof window.TradingView.widget === 'function') {
        clearInterval(intervalId);
        createWidget();
      }
    }, 100);

    return () => {
      clearInterval(intervalId);
      if (tvWidgetRef.current && typeof tvWidgetRef.current.remove === 'function') {
        tvWidgetRef.current.remove();
        tvWidgetRef.current = null;
      }
    };
  }, [symbol]);

  return <div id={chartContainerId} className="h-full w-full" />;
};

export default memo(TradingViewWidget);