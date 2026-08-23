-- 알뜰철도 X — Supabase(PostgreSQL) 스키마
--
-- 적용: Supabase 대시보드 → SQL Editor 에 이 파일을 통째로 붙여넣고 Run.
--       (또는 psql "$SUPABASE_DB_URL" -f BE/src/db/schema.sql)
--
-- 이 파일은 **몇 번을 다시 실행해도 안전하다** (idempotent).
-- 스키마를 고칠 땐 이 파일만 고치고 다시 Run 하면 된다.
--
-- ── 설계 원칙 ────────────────────────────────────────────────────
--
-- 1. 기준 데이터(역·노선·화주·공차·과거 실적)는 **컬럼으로 편다.**
--    Table Editor 에서 그대로 읽히는 게 시연 자산이다. 심사위원에게
--    "진짜 DB 위에서 돕니다" 를 보여주는 화면이 이 테이블들이다.
--
-- 2. 계산 결과(편성·조율·보조금 문서)는 **jsonb 로 통째로** 담는다.
--    도메인 타입(BE/src/types.ts)이 유일한 진실이고, 그 타입이 바뀔 때마다
--    마이그레이션을 새로 쓰는 건 시연 일정에 맞지 않는다.
--    단, 목록·필터에 쓰이는 키는 컬럼으로 **꺼내서 같이** 저장한다.
--
-- 3. RLS 를 전부 켜고 정책은 만들지 않는다.
--    서버(Route Handler)는 service_role 키로 붙어 RLS 를 우회하고,
--    anon 키로는 **아무것도 못 읽는다.** 키가 새어도 데이터는 안 샌다.
--    (이 앱은 브라우저에서 DB 를 직접 부르지 않는다 — 전부 /api/* 경유)

-- ════════════════════════════════════════════════════════════════
-- 0. 시퀀스 — 사람이 읽는 ID(SHM-USER-001, GRP-001 …) 발급용
-- ════════════════════════════════════════════════════════════════
--
-- ID 문자열을 만드는 규칙은 TypeScript 한 곳에만 둔다(BE/src/store.ts).
-- SQL 은 번호만 발급한다 — 규칙이 두 군데로 갈라지면 반드시 어긋난다.

create sequence if not exists railhub_shipment_seq   as bigint start 1;
create sequence if not exists railhub_confirm_seq    as bigint start 1;
create sequence if not exists railhub_negotiation_seq as bigint start 1;
create sequence if not exists railhub_application_seq as bigint start 1;

/**
 * 다음 번호 하나를 발급한다. 앱에서 supabase.rpc('railhub_next_seq', { kind }).
 *
 * kind 를 화이트리스트로 막아 둔다. 문자열을 그대로 nextval 에 넘기면
 * 임의 시퀀스를 건드릴 수 있는 통로가 된다.
 */
create or replace function railhub_next_seq(kind text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  return case kind
    when 'shipment'    then nextval('railhub_shipment_seq')
    when 'confirm'     then nextval('railhub_confirm_seq')
    when 'negotiation' then nextval('railhub_negotiation_seq')
    when 'application' then nextval('railhub_application_seq')
    else null
  end;
exception
  when others then
    raise exception 'railhub_next_seq: 알 수 없는 kind "%"', kind;
end;
$$;

revoke all on function railhub_next_seq(text) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- 1. 매칭 유니버스 (역·노선·화주·공차·시드화물) — 앱이 실제로 읽는다
-- ════════════════════════════════════════════════════════════════
--
-- 앱은 `BE/src/db/universe.ts` 의 loadUniverse() 로 이 테이블들을 읽는다.
-- Table Editor 에서 화차를 한 량 늘리면 공차 화면과 매칭 결과가 따라 바뀐다.
--
-- 다섯 테이블 중 하나라도 비어 있으면 **통째로** 번들 seed.json 으로 폴백한다
-- (섞으면 없는 노선을 가리키는 화차 같은 깨진 유니버스가 만들어진다).
-- DB 가 잠들어도 시연은 멈추지 않는다 — 그게 이 이중화의 목적이다.

create table if not exists stations (
  id          text primary key,
  name        text not null,
  region      text not null,
  lat         double precision not null,
  lng         double precision not null,
  handling    text[] not null default '{}',
  updated_at  timestamptz not null default now()
);

comment on table stations is '화물 취급역. seed.json 의 stations 미러';

create table if not exists lanes (
  id                text primary key,
  origin_station_id text not null references stations(id),
  dest_station_id   text not null references stations(id),
  rail_distance_km  double precision not null,
  road_distance_km  double precision not null,
  transit_hours     double precision not null,
  updated_at        timestamptz not null default now()
);

comment on column lanes.road_distance_km is '도로 직행 거리(baseline). 철도 거리와 다르다';

create table if not exists shippers (
  id                       text primary key,
  name                     text not null,
  industry                 text not null,
  company_grade            text not null
    check (company_grade in ('sme', 'excellentLogistics', 'general')),
  esg_disclosure_required  boolean not null default false,
  contact                  jsonb not null default '{}'::jsonb,
  updated_at               timestamptz not null default now()
);

-- 협약 물량·기간 (화주영업 화면의 이행률 분모). 나중에 추가된 컬럼이라 alter 로 붙인다.
alter table shippers add column if not exists contract jsonb not null default '{}'::jsonb;

comment on column shippers.contract is
  '전환교통 협약 — 번호·기간·협약물량. clients.ts 가 이행률 분모로 쓴다';

create table if not exists empty_wagons (
  id              text primary key,
  label           text not null,
  wagon_type      text not null
    check (wagon_type in ('covered', 'open', 'container', 'tank')),
  capacity_ton    double precision not null,
  capacity_cbm    double precision not null,
  capacity_basis  text not null,
  cutoff_at       timestamptz not null,
  min_load_rate   double precision not null,
  reserved_ton    double precision not null default 0,
  lane_id         text not null references lanes(id),
  departure_date  date not null,
  arrival_date    date not null,
  empty_reason    text not null,
  handling        text[] not null default '{}',
  -- departure/arrival 은 요일·시각까지 들고 있어 통째로도 보관한다
  payload         jsonb not null,
  updated_at      timestamptz not null default now()
);

comment on column empty_wagons.min_load_rate is
  '편성 성립 최저 적재율. 코레일 정책이 아니라 우리 손익분기선이다 (types.ts 참고)';

-- 조율 데모 시나리오 화차. 저장소에 누적된 등록 화물은 이 화차에 앉히지 않는다
-- (시작 상태가 반드시 정원 미달이어야 조율 시연이 성립한다 — matching.ts 참고).
alter table empty_wagons add column if not exists demo_scenario boolean not null default false;

create table if not exists seed_shipments (
  id                    text primary key,
  shipper_id            text not null,
  status                text not null
    check (status in ('requested', 'scheduled', 'pooled', 'confirmed')),
  pull_forward_eligible boolean not null default false,
  category              text not null,
  weight_ton            double precision not null,
  origin_station_id     text not null,
  dest_station_id       text not null,
  departure_date        date not null,
  -- Shipment 전체(cargo·origin·destination·constraints…)
  payload               jsonb not null,
  updated_at            timestamptz not null default now()
);

comment on table seed_shipments is
  '시연 시작 상태의 화물 풀. 사용자가 등록하는 화물은 registered_shipments 로 간다';

-- ════════════════════════════════════════════════════════════════
-- 2. 확정 수송 실적 원장 (ledger.json 미러)
-- ════════════════════════════════════════════════════════════════
--
-- K-ESG 리포트(#40~#42)가 집계하는 과거 실적. ledger.json 주석대로
-- "실제 서비스에서는 코레일 배차 확정 이력 DB가 이 자리를 대체한다" — 그 자리다.

create table if not exists trips (
  id                  text primary key,
  trip_date           date not null,
  lane_id             text not null,
  origin_station_id   text not null,
  dest_station_id     text not null,
  wagon_id            text not null,
  wagon_type          text not null,
  wagon_capacity_ton  double precision not null,
  created_at          timestamptz not null default now()
);

create index if not exists trips_date_idx on trips (trip_date);

create table if not exists trip_members (
  lot_id                   text primary key,
  trip_id                  text not null references trips(id) on delete cascade,
  shipper_id               text not null,
  shipper_name             text not null,
  category                 text not null,
  weight_ton               double precision not null,
  shuttle_km               double precision not null,
  road_direct_distance_km  double precision not null,
  current_road_fare_krw    double precision not null
);

create index if not exists trip_members_trip_idx on trip_members (trip_id);

comment on table trip_members is
  '한 편성에 실린 화주별 로트. 합적 실적이 이 테이블의 행 수로 드러난다';

-- ════════════════════════════════════════════════════════════════
-- 3. 가변 상태 — 여기가 이번에 DB 를 붙이는 진짜 이유
-- ════════════════════════════════════════════════════════════════
--
-- 지금까지 인메모리라 Vercel 람다 인스턴스가 갈리면 사라졌다.
-- 심사위원이 2주간 테스트하는 동안 등록한 화물이 남아 있어야 한다.

create table if not exists registered_shipments (
  id                 text primary key,
  seq                bigint not null unique,
  shipper_id         text not null,
  shipper_name       text,
  category           text not null,
  weight_ton         double precision not null,
  origin_station_id  text not null,
  dest_station_id    text not null,
  departure_date     date not null,
  -- 원본 입력. 부분 수정(PATCH)이 merge 후 재검증할 때 반드시 필요하다.
  input              jsonb not null,
  -- 정규화된 Shipment
  shipment           jsonb not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on column registered_shipments.input is
  '정규화 전 원본 입력. PATCH 가 {...input, ...patch} 로 합쳐 다시 검증한다';

create index if not exists registered_shipments_created_idx
  on registered_shipments (created_at desc);

create table if not exists confirmations (
  group_id      text primary key,
  seq           bigint not null unique,
  status        text not null default 'confirmed',
  wagon_id      text not null,
  total_ton     double precision not null,
  capacity_ton  double precision not null,
  load_factor   double precision not null,
  confirmed_at  timestamptz not null,
  wagon         jsonb not null,
  members       jsonb not null,
  calc          jsonb
);

create index if not exists confirmations_confirmed_idx
  on confirmations (confirmed_at desc);

-- 멱등 키. 화면이 같은 조율 세션으로 확정을 두 번 보내도(새로고침·더블클릭·
-- StrictMode 이중 실행) 편성이 두 개 생기지 않는다.
alter table confirmations add column if not exists client_key text;

create unique index if not exists confirmations_client_key_idx
  on confirmations (client_key) where client_key is not null;

-- ── 정산 제출 서류 ──────────────────────────────────────────────
-- 협약 정산에 첨부하는 서류의 제출 상태. 파일 자체는 보관하지 않고
-- "무엇이 언제 올라왔는지"만 기록한다 (시연 범위).

create table if not exists settlement_documents (
  key         text primary key,
  name        text not null,
  required    boolean not null default true,
  file        jsonb,
  updated_at  timestamptz not null default now()
);

comment on column settlement_documents.file is
  '업로드 메타데이터 { fileName, size, uploadedAt }. 파일 본문은 저장하지 않는다';

create table if not exists negotiations (
  id          text primary key,
  seq         bigint not null unique,
  status      text not null default 'open' check (status in ('open', 'cancelled')),
  result      jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists subsidy_applications (
  id           text primary key,
  seq          bigint not null unique,
  -- ⚠️ 이 초안을 만든 **바로 그 입력**. 재생성·편집 검증에 이걸 써야 한다.
  --    다시 계산하면 그 사이 편성이 바뀌어 문단과 표의 숫자가 어긋난다.
  input        jsonb not null,
  document     jsonb not null,
  diagnostics  jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists subsidy_applications_updated_idx
  on subsidy_applications (updated_at desc);

create table if not exists subsidy_revisions (
  id              bigint primary key generated always as identity,
  application_id  text not null references subsidy_applications(id) on delete cascade,
  at              timestamptz not null,
  paragraph_key   text not null,
  action          text not null check (action in ('generate', 'regenerate', 'edit')),
  before_text     text not null default '',
  after_text      text not null default '',
  source          text not null
);

create index if not exists subsidy_revisions_app_idx
  on subsidy_revisions (application_id, at);

comment on table subsidy_revisions is
  '문단 변경 이력 (api_list #38). AI 초안 → 사람 편집 흔적이 남는 게 심사 방어 포인트';

-- ════════════════════════════════════════════════════════════════
-- 4. RLS — 전부 켜고 정책은 두지 않는다 (service_role 만 통과)
-- ════════════════════════════════════════════════════════════════

do $$
declare t text;
begin
  foreach t in array array[
    'stations', 'lanes', 'shippers', 'empty_wagons', 'seed_shipments',
    'trips', 'trip_members',
    'registered_shipments', 'confirmations', 'negotiations',
    'subsidy_applications', 'subsidy_revisions', 'settlement_documents'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on table %I from anon, authenticated', t);
  end loop;
end $$;