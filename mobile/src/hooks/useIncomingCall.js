import { useEffect, useRef } from 'react';
import api from '../api/axios';

/**
 * Polls /api/calls/incoming every 4 seconds.
 * When a call arrives, calls onIncomingCall(callPayload).
 * Use this in your root navigator or main tab screen.
 */
export default function useIncomingCall(onIncomingCall) {
  const pollRef = useRef(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const { data } = await api.get('/calls/incoming');
        if (data.calls && data.calls.length > 0) {
          onIncomingCall(data.calls[0]);
        }
      } catch {}
    };

    poll();
    pollRef.current = setInterval(poll, 4000);
    return () => clearInterval(pollRef.current);
  }, []);
}
