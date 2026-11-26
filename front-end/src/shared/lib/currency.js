import { useEffect } from 'react';
import useViewState from '../hooks/useViewState.js';

/** Current exchange rate: 1 USD = 86.5 INR */
export const USD_TO_INR_RATE = 86.5;

export function getActiveCurrency() {
  try {
    const direct = localStorage.getItem('userCurrency');
    if (direct === 'USD' || direct === 'INR') return direct;

    const stored = localStorage.getItem('bb_profile_settings_v1');
    if (stored) {
      const parsed = JSON.parse(stored);
      for (const k of Object.keys(parsed)) {
        if (parsed[k]?.currency === 'USD' || parsed[k]?.currency === 'INR') {
          return parsed[k].currency;
        }
      }
    }
  } catch {}
  return 'INR';
}

export function setActiveCurrency(currency) {
  try {
    const safe = currency === 'USD' ? 'USD' : 'INR';
    localStorage.setItem('userCurrency', safe);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('currency-changed', { detail: safe }));
    }
  } catch {}
}

export function currencySymbol() {
  return getActiveCurrency() === 'USD' ? '$' : '₹';
}

export function convertInrToActiveCurrency(inrAmount) {
  const n = Number(inrAmount) || 0;
  if (getActiveCurrency() === 'USD') {
    return Number((n / USD_TO_INR_RATE).toFixed(2));
  }
  return n;
}

export function formatCurrency(value, { decimals = 2 } = {}) {
  const n = Number(value) || 0;
  const isNegative = n < 0;
  const abs = Math.abs(n);
  const currency = getActiveCurrency();

  if (currency === 'USD') {
    const converted = abs / USD_TO_INR_RATE;
    const formatted = converted.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return isNegative ? `-$${formatted}` : `$${formatted}`;
  }

  const whole = Number.isInteger(Number(abs.toFixed(decimals)));
  const formatted = abs.toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : decimals,
    maximumFractionDigits: decimals,
  });
  return isNegative ? `-₹${formatted}` : `₹${formatted}`;
}

export function useCurrency() {
  const [currency, setCurrency] = useViewState(getActiveCurrency);

  useEffect(() => {
    const handleCurrencyChange = () => {
      setCurrency(getActiveCurrency());
    };
    window.addEventListener('currency-changed', handleCurrencyChange);
    window.addEventListener('storage', handleCurrencyChange);
    return () => {
      window.removeEventListener('currency-changed', handleCurrencyChange);
      window.removeEventListener('storage', handleCurrencyChange);
    };
  }, [setCurrency]);

  return currency;
}
