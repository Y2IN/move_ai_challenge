-- 2026-08-23 — 하이브리드 매칭 · 확정 멱등 · 정산 서류
--
-- 적용: Supabase 대시보드 → SQL Editor 에 이 파일을 통째로 붙여넣고 Run.
--       (schema.sql 전체를 다시 돌려도 결과는 같습니다 — 이 파일은 이번에 늘어난
--        부분만 뽑아 둔 것이라 더 짧고 안전합니다.)
--
-- 몇 번을 다시 실행해도 안전합니다. 적용 후 `npm run db:push` 를 한 번 돌리면
-- 새 컬럼에 값이 채워집니다.
--
-- ── 안 하면 어떻게 되나 ──────────────────────────────────────────
-- 앱은 그대로 뜹니다. 다만 아래가 폴백으로 돕니다:
--   shippers.contract          → 협약 물량을 번들 seed.json 에서 읽음
--   empty_wagons.demo_scenario → payload(jsonb) 안의 값으로 대체 (동작은 동일)
--   confirmations.client_key   → 확정 멱등이 인스턴스 메모리 범위로 축소
--                                (서버리스에서 인스턴스가 갈리면 편성이 중복 발급될 수 있음)
--   settlement_documents       → 증빙 제출 상태가 인스턴스 메모리에만 남음

-- 1. 화주 협약 — 화주영업 화면의 이행률 분모
alter table shippers add column if not exists contract jsonb not null default '{}'::jsonb;

comment on column shippers.contract is
  '전환교통 협약 — 번호·기간·협약물량. clients.ts 가 이행률 분모로 쓴다';

-- 2. 조율 데모 시나리오 화차
--    저장소에 누적된 등록 화물은 이 화차에 앉히지 않는다 (시작 상태가 반드시
--    정원 미달이어야 조율 시연이 성립한다 — BE/src/matching.ts 의 seatOnWagon).
alter table empty_wagons add column if not exists demo_scenario boolean not null default false;

-- 3. 확정 멱등 키
--    화면이 같은 조율 세션으로 확정을 두 번 보내도(새로고침·더블클릭·StrictMode
--    이중 실행) 편성이 두 개 생기지 않는다.
alter table confirmations add column if not exists client_key text;

create unique index if not exists confirmations_client_key_idx
  on confirmations (client_key) where client_key is not null;

-- 4. 정산 제출 서류
--    파일 본문은 보관하지 않는다 — "무엇이 언제 올라왔는지"만 기록한다.
create table if not exists settlement_documents (
  key         text primary key,
  name        text not null,
  required    boolean not null default true,
  file        jsonb,
  updated_at  timestamptz not null default now()
);

comment on column settlement_documents.file is
  '업로드 메타데이터 { name, uploadedAt }. 파일 본문은 저장하지 않는다';

-- 5. RLS — 새 테이블도 서버(service_role)만 통과시킨다
alter table settlement_documents enable row level security;
revoke all on table settlement_documents from anon, authenticated;
