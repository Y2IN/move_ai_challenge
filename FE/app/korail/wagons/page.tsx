'use client';

import { useRouter } from 'next/navigation';
import { WagonScreen } from '@/src/screens/WagonScreen';

export default function KorailWagonsPage() {
  const router = useRouter();
  return <WagonScreen onNavigate={(to) => router.push(to)} />;
}
