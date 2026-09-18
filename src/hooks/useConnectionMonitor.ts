import { useState, useEffect } from 'react';

interface ConnectionState {
  status: 'ok' | 'error' | 'checking';
  lastCheck: string | null;
  details: string | null;
}

export function useConnectionMonitor() {
  const [googleStatus, setGoogleStatus] = useState<ConnectionState>({
    status: 'checking',
    lastCheck: null,
    details: null
  });

  const checkConnection = async () => {
    try {
      const response = await fetch('/api/health/external');
      const data = await response.json();
      
      setGoogleStatus({
        status: data.google.status,
        lastCheck: data.timestamp,
        details: data.google.details || null
      });

      // Log to console for user visibility
      if (data.google.status === 'error') {
        console.warn(`[ConnectionMonitor] Intermittency detected at ${data.timestamp}: ${data.google.details}`);
      }
    } catch (error) {
      setGoogleStatus({
        status: 'error',
        lastCheck: new Date().toISOString(),
        details: 'Failed to reach server'
      });
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 1000 * 60 * 5); // Check every 5 minutes
    return () => clearInterval(interval);
  }, []);

  return { googleStatus, checkConnection };
}
