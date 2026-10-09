export const money = (c) => `${c < 0 ? '-' : ''}$${Math.abs(c / 100).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const money0 = (c) => `${c < 0 ? '-' : ''}$${Math.round(Math.abs(c / 100)).toLocaleString('en-CA')}`;
