import { useCallback, useEffect, useRef, useState } from 'react';
import { posApi } from '../services/posApi';

const POLL_MS = 4000;
const MAX_POLLS = 45; // ~3 minutes

/**
 * Initiate a Flutterwave mobile money charge and poll until paid / failed / timeout.
 */
export function useMobileMoneyPayment({ onSuccess, onError } = {}) {
  const [phase, setPhase] = useState('idle'); // idle | requesting | waiting | success | failed
  const [message, setMessage] = useState('');
  const [txRef, setTxRef] = useState(null);
  const pollRef = useRef(null);
  const pollCountRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const pollStatus = useCallback(
    (ref) => {
      stopPolling();
      pollCountRef.current = 0;
      setPhase('waiting');
      setMessage('Waiting for customer to approve on their phone…');

      pollRef.current = setInterval(async () => {
        pollCountRef.current += 1;
        if (pollCountRef.current > MAX_POLLS) {
          stopPolling();
          setPhase('failed');
          setMessage('Payment timed out. Ask the customer to try again.');
          onError?.({ message: 'Payment timed out' });
          return;
        }

        try {
          const res = await posApi.mobileMoneyStatus(ref);
          const data = res.data?.data;
          if (data?.paymentStatus === 'paid') {
            stopPolling();
            setPhase('success');
            setMessage('Payment received!');
            onSuccess?.(data);
          } else if (data?.paymentStatus === 'failed') {
            stopPolling();
            setPhase('failed');
            setMessage(data.message || 'Payment failed');
            onError?.(data);
          } else if (data?.message) {
            setMessage(data.message);
          }
        } catch (err) {
          // Keep polling on transient errors
          if (pollCountRef.current >= MAX_POLLS) {
            stopPolling();
            setPhase('failed');
            setMessage(err.response?.data?.message || 'Could not verify payment');
            onError?.(err);
          }
        }
      }, POLL_MS);
    },
    [onError, onSuccess, stopPolling]
  );

  const requestPayment = useCallback(
    async (payload) => {
      stopPolling();
      setPhase('requesting');
      setMessage('Sending payment request…');
      setTxRef(null);

      try {
        const res = await posApi.initiateMobileMoney(payload);
        const data = res.data?.data;
        const ref = data?.txRef;
        if (!ref) throw new Error('No payment reference returned');

        setTxRef(ref);
        setMessage(data.message || 'Payment request sent to customer phone.');
        pollStatus(ref);
        return data;
      } catch (err) {
        setPhase('failed');
        const msg = err.response?.data?.message || err.message || 'Payment request failed';
        setMessage(msg);
        onError?.(err);
        throw err;
      }
    },
    [onError, pollStatus, stopPolling]
  );

  const reset = useCallback(() => {
    stopPolling();
    setPhase('idle');
    setMessage('');
    setTxRef(null);
  }, [stopPolling]);

  return {
    phase,
    message,
    txRef,
    isBusy: phase === 'requesting' || phase === 'waiting',
    requestPayment,
    reset
  };
}
