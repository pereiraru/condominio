'use client';

import { MonthPaymentStatus } from '@/lib/types';

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

interface MonthCalendarProps {
  year: number;
  onYearChange: (year: number) => void;
  monthStatus: MonthPaymentStatus[];
  selectedMonths?: string[];
  onToggleMonth?: (month: string) => void;
  readOnly?: boolean;
}

export default function MonthCalendar({
  year,
  onYearChange,
  monthStatus,
  selectedMonths = [],
  onToggleMonth,
  readOnly = false,
}: MonthCalendarProps) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          className="text-gray-500 hover:text-gray-700 px-2 py-1"
          onClick={() => onYearChange(year - 1)}
        >
          &larr;
        </button>
        <span className="font-bold text-gray-700">{year}</span>
        <button
          type="button"
          className="text-gray-500 hover:text-gray-700 px-2 py-1"
          onClick={() => onYearChange(year + 1)}
        >
          &rarr;
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {MONTH_NAMES.map((name, index) => {
          const monthStr = `${year}-${(index + 1).toString().padStart(2, '0')}`;
          const status = monthStatus.find((s) => s.month === monthStr);
          const isSelected = !readOnly && selectedMonths.includes(monthStr);
          const isPast = monthStr < currentMonth;
          const isCurrent = monthStr === currentMonth;

          let bgColor = 'bg-gray-100 text-gray-600'; // future
          if (status) {
            if (status.isPaid) {
              bgColor = 'bg-green-100 text-green-700';
            } else if (isPast || isCurrent) {
              if (status.paid > 0 && status.paid < status.expected) {
                bgColor = 'bg-yellow-100 text-yellow-700'; // partial
              } else {
                bgColor = 'bg-red-100 text-red-700'; // unpaid
              }
            }
          }

          if (isSelected) {
            bgColor = 'bg-primary-500 text-white ring-2 ring-primary-300';
          }

          const content = (
            <>
              <div>{name}</div>
              {status && status.expected > 0 && !isSelected && (
                <div className="text-xs mt-0.5 opacity-75">
                  {status.paid > 0 ? `${status.paid.toFixed(0)}€` : '-'}
                </div>
              )}
            </>
          );

          if (readOnly) {
            return (
              <div
                key={monthStr}
                className={`px-2 py-2 rounded-lg text-sm font-medium text-center ${bgColor}`}
              >
                {content}
              </div>
            );
          }

          return (
            <button
              key={monthStr}
              type="button"
              className={`px-2 py-2 rounded-lg text-sm font-medium transition-all ${bgColor} hover:opacity-80`}
              onClick={() => onToggleMonth?.(monthStr)}
            >
              {content}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span> Pago
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-300"></span> Em divida
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></span> Parcial
        </span>
        {!readOnly && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-primary-500 border border-primary-300"></span> Selecionado
          </span>
        )}
      </div>
    </div>
  );
}
