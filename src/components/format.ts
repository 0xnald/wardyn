export const usd = (value: string | number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value));
export const pct = (value: number) => `${value.toFixed(1)}%`;
export const amount = (value: string) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 }).format(Number(value));
export const time = (value: string) =>
  new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
export const assetNames: Record<string, string> = {
  BTC: 'Bitcoin',
  BNB: 'BNB',
  SOL: 'Solana',
  USDT: 'Tether',
};
