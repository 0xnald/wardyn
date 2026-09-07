import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Wardyn — Your positions never go unwatched.',
  description:
    'Policy-driven Binance position management. Hold, reduce, exit, or rebalance with explainable decision receipts.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
