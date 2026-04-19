import { useState, useCallback } from 'react';

export default function useToast() {
  const [toast, setToast] = useState({ visible: false, type: 'success', message: '' });

  const show = useCallback((message, type = 'success') => {
    setToast({ visible: true, type, message });
  }, []);

  const hide = useCallback(() => setToast(t => ({ ...t, visible: false })), []);

  const success = useCallback((msg) => show(msg, 'success'), [show]);
  const error   = useCallback((msg) => show(msg, 'error'),   [show]);
  const info    = useCallback((msg) => show(msg, 'info'),    [show]);

  return { toast, hide, success, error, info };
}
