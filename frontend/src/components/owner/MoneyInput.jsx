import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

/**
 * MoneyInput: Rupee-denominated numeric input with Indian number grouping.
 * Enforces maximum 2 decimal places and produces pure string values (never floats).
 *
 * Example: value "120000.50" displays as "1,20,000.50".
 */
export function formatIndianCurrencyDisplay(rawStr) {
  if (!rawStr) return '';
  const clean = String(rawStr).replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  let integerPart = parts[0] || '';
  const decimalPart = parts.length > 1 ? parts[1].slice(0, 2) : null;

  // Format integer portion in Indian format (last 3, then pairs of 2)
  if (integerPart.length > 3) {
    const lastThree = integerPart.slice(-3);
    const remaining = integerPart.slice(0, -3);
    const paired = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    integerPart = `${paired},${lastThree}`;
  }

  if (decimalPart !== null) {
    return `${integerPart}.${decimalPart}`;
  }
  return integerPart;
}

export function parseRawMoneyString(displayStr) {
  if (!displayStr) return '';
  const clean = String(displayStr).replace(/[^0-9.]/g, '');
  const parts = clean.split('.');
  if (parts.length > 2) {
    // Only keep first decimal point
    return `${parts[0]}.${parts.slice(1).join('')}`;
  }
  if (parts.length === 2) {
    return `${parts[0]}.${parts[1].slice(0, 2)}`;
  }
  return parts[0] || '';
}

export function MoneyInput({
  value = '',
  onChange,
  onBlur,
  placeholder = '0.00',
  disabled = false,
  error,
  className = '',
  id,
  name,
  'aria-describedby': ariaDescribedBy,
}) {
  const [displayValue, setDisplayValue] = useState(() => formatIndianCurrencyDisplay(value));

  useEffect(() => {
    setDisplayValue(formatIndianCurrencyDisplay(value));
  }, [value]);

  const handleChange = (e) => {
    const inputVal = e.target.value;
    const rawMoney = parseRawMoneyString(inputVal);
    setDisplayValue(formatIndianCurrencyDisplay(rawMoney));
    if (onChange) {
      onChange(rawMoney);
    }
  };

  const handleBlur = (e) => {
    // Format to 2 decimal places on blur if user typed an integer or partial decimal
    let raw = parseRawMoneyString(displayValue);
    if (raw && !raw.includes('.')) {
      raw = `${raw}.00`;
    } else if (raw && raw.endsWith('.')) {
      raw = `${raw}00`;
    } else if (raw && raw.split('.')[1]?.length === 1) {
      raw = `${raw}0`;
    }
    setDisplayValue(formatIndianCurrencyDisplay(raw));
    if (onChange && raw !== value) {
      onChange(raw);
    }
    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-body font-medium text-sm select-none">
        ₹
      </div>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        aria-describedby={ariaDescribedBy}
        aria-invalid={Boolean(error)}
        className={cn(
          'w-full pl-8 pr-4 py-2.5 rounded-xl border bg-card text-ink placeholder:text-body/50 text-sm font-medium',
          'transition-colors focus:outline-none focus-ring min-h-[44px]',
          error ? 'border-danger focus:ring-danger/20' : 'border-border focus:border-primary',
          disabled && 'opacity-60 cursor-not-allowed bg-sand',
          className
        )}
      />
    </div>
  );
}
