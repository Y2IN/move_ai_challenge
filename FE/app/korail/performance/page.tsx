'use client';

import { PerformanceScreen } from '@/src/screens/PerformanceScreen';

export default function KorailPerformancePage() {
  /** 인쇄용 HTML 을 새 탭에서 열고 바로 인쇄 대화상자를 띄웁니다 (Scope 3 내보내기와 같은 방식). */
  const openReport = (query: string) =>
    window.open(`/api/korail/performance/report?format=pdf&autoprint=1&${query}`, '_blank');

  return (
    <PerformanceScreen
      onPublish={() => openReport('persona=korail&quarters=4')}
      onOpenLast={(period) => openReport(`persona=korail&period=${encodeURIComponent(period)}`)}
    />
  );
}
