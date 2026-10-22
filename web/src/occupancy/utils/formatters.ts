export function formatCurrency(amount: number | null | undefined, options?: { showCents?: boolean }): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '—';
  }
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: options?.showCents ? 2 : 0,
    minimumFractionDigits: options?.showCents ? 2 : 0,
  }).format(amount);
}

export function formatPercent(rate: number | null | undefined, decimals = 1): string {
  if (rate === null || rate === undefined || isNaN(rate)) {
    return 'N/A';
  }
  return `${rate.toFixed(decimals)}%`;
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return new Intl.DateTimeFormat('en-CA', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date);
    }
    return dateString;
  } catch {
    return dateString;
  }
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  return new Intl.NumberFormat('en-CA').format(value);
}

/**
 * Calculates days between two dates.
 * If asOfDate is provided, computes days difference from asOfDate to targetDate or vice versa.
 */
export function calculateDaysDifference(startDateStr: string, endDateStr: string): number {
  try {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const diffTime = end.getTime() - start.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}
