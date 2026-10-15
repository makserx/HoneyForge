'use client';

import React from 'react';
import { AttackEvent } from '@/lib/types';
import { AlertTriangleIcon, XCircleIcon, GlobeIcon, ServerIcon } from './icons';

interface Props {
  event: AttackEvent | null;
  onClose: () => void;
}

export function EventDetailModal({ event, onClose }: Props) {
  if (!event) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="cyber-card p-6 rounded-2xl border border-slate-700 bg-slate-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-5">
        {/* Заголовок */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <AlertTriangleIcon
              className={`w-5 h-5 ${
                event.severity === 'critical'
                  ? 'text-rose-400'
                  : event.severity === 'high'
                  ? 'text-amber-400'
                  : 'text-sky-400'
              }`}
            />
            <div>
              <h3 className="text-base font-bold text-white">
                Анализ вторжения: {event.id}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Зафиксировано: {new Date(event.timestamp).toLocaleString('ru-RU')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <XCircleIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Сводка об источнике угрозы и цели */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Источник атаки
            </span>
            <div className="text-base font-black text-amber-400 font-mono">
              {event.sourceIp}:{event.sourcePort}
            </div>
            <div className="text-xs text-slate-300 flex items-center gap-1.5 pt-1">
              <GlobeIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>{event.city ? `${event.city}, ${event.country}` : event.country || 'Неизвестная геопозиция'}</span>
              {event.asn && <span className="text-slate-500 font-mono">({event.asn})</span>}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Целевая ловушка
            </span>
            <div className="text-base font-black text-slate-100 font-mono">
              Порт {event.destPort} ({event.protocol})
            </div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5 pt-1">
              <ServerIcon className="w-3.5 h-3.5 text-slate-500" />
              <span>{event.agentName} ({event.honeypotType})</span>
            </div>
          </div>
        </div>

        {/* Детали индикаторов компрометации (IOC) и полезной нагрузки */}
        <div className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Индикаторы компрометации (IOC) и данные эксплойта
          </span>

          {event.details.username && (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Перехваченные учетные данные:</span>
              <span className="text-amber-300 font-bold bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/60">
                {event.details.username}:{event.details.password || '<пусто>'}
              </span>
            </div>
          )}

          {event.details.command && (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <span className="text-slate-400 font-semibold block">Команда атакующего (Shell):</span>
              <pre className="font-mono text-purple-300 whitespace-pre-wrap bg-slate-900/60 p-2 rounded">
                {event.details.command}
              </pre>
            </div>
          )}

          {event.details.url && (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <span className="text-slate-400 font-semibold block">Вектор HTTP-запроса:</span>
              <div className="font-mono text-sky-300">
                {event.details.method || 'GET'} {event.details.url}
              </div>
              {event.details.userAgent && (
                <div className="text-[11px] text-slate-500 font-mono pt-1">
                  User-Agent: {event.details.userAgent}
                </div>
              )}
            </div>
          )}

          {event.details.payload && (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <span className="text-slate-400 font-semibold block">Извлечённая полезная нагрузка / Сигнатура эксплойта:</span>
              <pre className="font-mono text-slate-200 whitespace-pre-wrap bg-slate-900/60 p-2 rounded text-[11px]">
                {event.details.payload}
              </pre>
            </div>
          )}

          {event.details.rawData && (
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <span className="text-slate-400 font-semibold block">Сырые байты сессии (TCP / Баннер):</span>
              <pre className="font-mono text-slate-400 whitespace-pre-wrap bg-slate-900/60 p-2 rounded text-[10px] max-h-36 overflow-y-auto">
                {event.details.rawData}
              </pre>
            </div>
          )}
        </div>

        {/* Исходные данные события в формате JSON */}
        <details className="text-xs group">
          <summary className="text-slate-400 hover:text-slate-200 cursor-pointer font-semibold py-1">
            Сырые данные события в формате JSON ▸
          </summary>
          <pre className="mt-2 p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-400 max-h-48 overflow-y-auto">
            {JSON.stringify(event, null, 2)}
          </pre>
        </details>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg text-xs cursor-pointer"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
