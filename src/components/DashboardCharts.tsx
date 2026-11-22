'use client';

import { useId } from 'react';
import type { DashboardBalanceHistoryPoint } from '@/lib/types';

function formatEurPlain(value: number): string {
  return `${value.toLocaleString('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

export function BankBalanceSparkline({
  points,
}: {
  points: DashboardBalanceHistoryPoint[];
}) {
  const rawId = useId();
  const gradId = `spark-fill-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  if (!points || points.length < 2) {
    return null;
  }

  const width = 180;
  const height = 56;
  const padX = 8;
  const padTop = 8;
  const padBottom = 12;
  const usableWidth = width - padX * 2;
  const usableHeight = height - padTop - padBottom;

  const totals = points.map((p) => p.total);
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  const span = max - min;

  const coords = points.map((p, idx) => {
    const x =
      points.length === 1
        ? width / 2
        : padX + (idx / (points.length - 1)) * usableWidth;
    const y =
      span < 0.01
        ? 27
        : padTop + (1 - (p.total - min) / span) * usableHeight;
    return { x, y, month: p.month, total: p.total };
  });

  // Smooth cubic Bézier curve connecting consecutive monthly snapshots
  let linePath = `M ${coords[0].x.toFixed(2)} ${coords[0].y.toFixed(2)}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const midX = ((prev.x + curr.x) / 2).toFixed(2);
    linePath += ` C ${midX} ${prev.y.toFixed(2)}, ${midX} ${curr.y.toFixed(2)}, ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
  }

  const first = coords[0];
  const last = coords[coords.length - 1];
  const baselineY = height - 4;
  const areaPath = `${linePath} L ${last.x.toFixed(2)} ${baselineY} L ${first.x.toFixed(2)} ${baselineY} Z`;

  const ariaLabel = `Evolução das disponibilidades bancárias nos últimos ${points.length} meses: mínimo de ${formatEurPlain(min)}, máximo de ${formatEurPlain(max)} e saldo mais recente de ${formatEurPlain(last.total)}.`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-36 sm:w-44 h-12 sm:h-14 shrink-0 overflow-visible"
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
        </linearGradient>
      </defs>

      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke="#34d399"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 0 6px rgba(52, 211, 153, 0.45))' }}
      />
      <circle
        cx={last.x}
        cy={last.y}
        r={5.5}
        fill="#34d399"
        fillOpacity="0.26"
      />
      <circle
        cx={last.x}
        cy={last.y}
        r={3}
        fill="#6ee7b7"
        stroke="#0f172a"
        strokeWidth="1.25"
      />
    </svg>
  );
}

interface ComplianceDonutProps {
  paid: number;
  overdue: number;
  pending: number;
  total: number;
}

export function ComplianceDonutChart({
  paid,
  overdue,
  pending,
  total,
}: ComplianceDonutProps) {
  const radius = 37;
  const circumference = 2 * Math.PI * radius;
  const safeTotal = total > 0 ? total : paid + overdue + pending;

  const segments = [
    { key: 'paid', label: 'Pagas', count: paid, color: '#10b981', dotClass: 'bg-emerald-500' },
    { key: 'overdue', label: 'Em atraso', count: overdue, color: '#f59e0b', dotClass: 'bg-amber-500' },
    { key: 'pending', label: 'Pendentes', count: pending, color: '#cbd5e1', dotClass: 'bg-slate-300' },
  ];

  const nonZeroSegments = segments.filter((s) => s.count > 0);
  let cumulativeOffset = 0;

  const renderedArcs =
    safeTotal > 0
      ? nonZeroSegments.map((seg) => {
          const rawLen = (seg.count / safeTotal) * circumference;
          const gap = nonZeroSegments.length > 1 ? Math.min(3.5, rawLen * 0.22) : 0;
          const drawLen = Math.max(0.5, rawLen - gap);
          const dashOffset = -cumulativeOffset;
          cumulativeOffset += rawLen;
          return {
            ...seg,
            dashArray: `${drawLen.toFixed(2)} ${(circumference - drawLen).toFixed(2)}`,
            dashOffset: dashOffset.toFixed(2),
          };
        })
      : [];

  const ariaLabel = `Distribuição das ${safeTotal} frações no ano: ${paid} pagas, ${overdue} em atraso e ${pending} pendentes.`;

  return (
    <div className="flex items-center gap-3.5 sm:gap-4">
      <svg
        width={86}
        height={86}
        viewBox="0 0 100 100"
        className="w-[78px] h-[78px] sm:w-[86px] sm:h-[86px] shrink-0"
        role="img"
        aria-label={ariaLabel}
      >
        <title>{ariaLabel}</title>
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="13"
        />
        <g transform="rotate(-90 50 50)">
          {renderedArcs.map((arc) => (
            <circle
              key={arc.key}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth="13"
              strokeDasharray={arc.dashArray}
              strokeDashoffset={arc.dashOffset}
              strokeLinecap="butt"
            />
          ))}
        </g>
      </svg>

      <dl className="space-y-1.5 text-xs min-w-0">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center justify-between gap-2.5">
            <dt className="flex items-center gap-1.5 text-slate-600 whitespace-nowrap">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${seg.dotClass}`}
                aria-hidden="true"
              />
              <span>{seg.label}</span>
            </dt>
            <dd className="font-semibold text-slate-800 tabular-nums">{seg.count}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
