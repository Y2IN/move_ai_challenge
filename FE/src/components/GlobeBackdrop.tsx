'use client';

import { useEffect, useRef } from 'react';

/** 화면 위 점 간격(px) — 각도가 아니라 픽셀로 잡아야 지구본 크기가 바뀌어도 밀도가 같습니다 */
const DOT_GAP = 9;

/**
 * 지축 기울기(rad). **0 이면 안 됩니다** — 정사영에서 기울기가 없으면 위선의
 * y 가 위도마다 상수라 완벽한 수평 직선으로 그려지고, 지구본이 아니라 화면을
 * 가로지르는 구분선처럼 보입니다.
 */
const TILT = (17 * Math.PI) / 180;
const COS_T = Math.cos(TILT);
const SIN_T = Math.sin(TILT);

/**
 * 히어로 배경에서 천천히 도는 점 지구본. originkit `hero-23` 의 모션만 옮겼습니다.
 *
 * ponytail: 대륙 대신 sin/cos 두 줄로 만든 덩어리 패턴 — 지오 데이터(수백 KB)를
 *           들이지 않고도 회전이 눈에 보입니다. 균일 격자만 쓰면 회전이
 *           보이지 않으므로(격자가 자기 자신으로 겹칩니다) 패턴은 필수입니다.
 *           실제 대륙 실루엣이 필요해지면 저해상도 land mask 로 이 판정을 바꾸세요.
 */
export function GlobeBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;

    // 모션 최소화 설정이면 회전 없이 한 장만 그립니다
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let w = 0;
    let h = 0;

    /**
     * 구면 좌표 → 화면 좌표. y 축 회전(자전) 후 x 축으로 TILT 만큼 기울입니다.
     * 뒤쪽 반구는 그리지 않으므로 null. `z` 는 0~1 로 정규화한 깊이입니다.
     */
    const project = (lat: number, lon: number, rot: number, R: number, cx: number, cy: number) => {
      const cl = Math.cos(lat);
      const a = lon + rot;
      const y0 = Math.sin(lat);
      const z0 = cl * Math.cos(a);
      const z = y0 * SIN_T + z0 * COS_T;
      if (z <= 0) return null;
      return { x: cx + R * cl * Math.sin(a), y: cy - R * (y0 * COS_T - z0 * SIN_T), z };
    };

    const draw = (t: number) => {
      const rot = still ? 0.6 : t / 9000;
      const R = Math.max(w * 0.5, 460);
      const cx = w / 2;
      // 구 중심을 화면 아래로 내려 상단 캡만 보이게 — 히어로 밑에서 떠오르는 모양
      const cy = h + R * 0.34;
      const step = DOT_GAP / R;
      // 화면 하단에 걸리는 위도부터 위로. 기울기 때문에 같은 위도에서도 y 가
      // ±R·sinT 만큼 흔들리므로 그만큼 여유를 두고 시작합니다
      const latFrom = Math.asin(Math.min(Math.max(((cy - h) / R - SIN_T) / COS_T, -1), 1));

      ctx.clearRect(0, 0, w, h);

      for (let lat = latFrom; lat < Math.PI / 2; lat += step) {
        const cl = Math.cos(lat);
        const lonStep = step / Math.max(cl, 0.03);
        // 앞쪽 반구 + 기울기로 넓어지는 만큼의 여유. 실제 판정은 project 가 합니다.
        // 절대 경도 격자에 맞춰 시작점을 잡아야 회전할 때 점이 같이 흐릅니다
        const half = Math.PI / 2 + 0.5;
        const from = Math.ceil((-half - rot) / lonStep) * lonStep;
        for (let lon = from; lon + rot < half; lon += lonStep) {
          const patch = Math.sin(3 * lat + 1.7) * Math.cos(2.5 * lon) + 0.6 * Math.sin(5 * lon + 2 * lat);
          if (patch < 0.05) continue;
          const p = project(lat, lon, rot, R, cx, cy);
          if (!p || p.y < 0 || p.y > h) continue;
          ctx.fillStyle = `rgba(255,255,255,${0.9 * p.z * p.z})`;
          ctx.fillRect(p.x, p.y, 1.9, 1.9);
        }
      }

      // 경선·위선. 실루엣 쪽으로 갈수록 투명해지는 방사 그라디언트를 stroke 색으로
      // 씁니다 — 안 그러면 선이 구 테두리에서 뚝 끊겨 밖으로 튀어나온 것처럼 보입니다
      const limb = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      limb.addColorStop(0, 'rgba(255,255,255,0.45)');
      limb.addColorStop(0.72, 'rgba(255,255,255,0.24)');
      limb.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.lineWidth = 1;
      ctx.strokeStyle = limb;

      const LINE_STEP = (2 * Math.PI) / 180;
      const line = (pts: ReturnType<typeof project>[]) => {
        ctx.beginPath();
        let open = false;
        for (const p of pts) {
          if (!p) {
            open = false;
            continue;
          }
          if (open) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
          open = true;
        }
        ctx.stroke();
      };

      for (let m = 0; m < 12; m++) {
        const lon = (m * Math.PI) / 6;
        const pts = [];
        for (let lat = -Math.PI / 2; lat <= Math.PI / 2; lat += LINE_STEP) {
          pts.push(project(lat, lon, rot, R, cx, cy));
        }
        line(pts);
      }
      for (let lat = -Math.PI / 2 + Math.PI / 9; lat < Math.PI / 2; lat += Math.PI / 9) {
        const pts = [];
        for (let lon = 0; lon <= Math.PI * 2; lon += LINE_STEP) {
          pts.push(project(lat, lon, rot, R, cx, cy));
        }
        line(pts);
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.clientWidth;
      h = cv.clientHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (still) draw(0);
    };

    const frame = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(frame);
    };

    resize();
    if (still) draw(0);
    else raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full [mask-image:linear-gradient(to_bottom,transparent,#000_42%,#000_92%,transparent)]"
    />
  );
}
