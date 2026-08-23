'use client';

import { ClientsScreen } from '@/src/screens/ClientsScreen';

export default function KorailClientsPage() {
  // 내보내기는 서버가 만든 파일을 새 탭에서 받습니다 (화면이 다시 계산하지 않습니다).
  return <ClientsScreen onExport={() => window.open('/api/korail/clients/export?format=xlsx', '_blank')} />;
}
