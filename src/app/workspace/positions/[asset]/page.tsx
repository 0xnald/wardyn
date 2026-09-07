import { notFound } from 'next/navigation';
import { PositionDetail } from '../../../../components/position';
export default async function Page({ params }: { params: Promise<{ asset: string }> }) {
  const { asset } = await params;
  if (!['BTC', 'BNB', 'SOL', 'USDT'].includes(asset)) notFound();
  return <PositionDetail asset={asset} />;
}
