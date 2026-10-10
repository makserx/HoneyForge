'use client';

import React, { useState } from 'react';
import { AttackEvent, EventSeverity } from '@/lib/types';
import {
  ActivityIcon,
  SearchIcon,
  TrashIcon,
  ZapIcon,
  GlobeIcon,
} from './icons';

interface Props {
  events: AttackEvent[];
  sseStatus: 'connected' | 'connecting' | 'disconnected';
  onClearEvents: () => void;
  onSimulateAttack: () => void;
  onSelectEvent: (event: AttackEvent) => void;
}

export function AttackFeedView({
  events,
  sseStatus,
  onClearEvents,
  onSimulateAttack,
  onSelectEvent,
}: Props) {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  const filteredEvents = events.filter((e) => {
    if (selectedSeverity !== 'all' && e.severity !== selectedSeverity) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        e.sourceIp.toLowerCase().includes(q) ||
        e.protocol.toLowerCase().includes(q) ||
        (e.details.payload && e.details.payload.toLowerCase().includes(q)) ||
        (e.details.username && e.details.username.toLowerCase().includes(q)) ||
        (e.details.command && e.details.command.toLowerCase().includes(q)) ||
        (e.country && e.country.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  const getSeverityBadge = (severity: EventSeverity) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-950/80 text-rose-400 border border-rose-800/80">
            Критический
          </span>
        );
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-950/80 text-amber-400 border border-amber-800/80">
            Высокий
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-950/80 text-sky-400 border border-sky-800/80">
            Средний
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
            Низкий
          </span>
        );
    }
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `honeyforge_attacks_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="cyber-card p-5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ActivityIcon className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white tracking-wide">
              Онлайн-лента событий атак (FR-C4, FR-C5)
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Телеметрия в реальном времени от скрытых агентов и ловушек через Server-Sent Events (SSE).
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* SSE Status Pill */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border ${
              sseStatus === 'connected'
                ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-300'
                : sseStatus === 'connecting'
                ? 'bg-amber-950/70 border-amber-800/80 text-amber-300'
                : 'bg-rose-950/70 border-rose-800/80 text-rose-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                sseStatus === 'connected'
                  ? 'bg-emerald-400 animate-pulse'
                  : sseStatus === 'connecting'
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
              }`}
            />
            {sseStatus === 'connected' ? 'SSE АКТИВЕН' : sseStatus === 'connecting' ? 'ПОДКЛЮЧЕНИЕ' : 'ОТКЛЮЧЕНО'}
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              isPaused
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {isPaused ? '▶ Возобновить ленту' : '⏸ Пауза ленты'}
          </button>

          <button
            onClick={onSimulateAttack}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-bold rounded-lg shadow transition-all cursor-pointer"
          >
            <ZapIcon className="w-3.5 h-3.5" />
            Тестовая атака
          </button>

          <button
            onClick={handleExportJson}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-all cursor-pointer"
          >
            Экспорт JSON
          </button>

          <button
            onClick={onClearEvents}
            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-950/30 transition-all cursor-pointer"
            title="Очистить журнал событий"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по IP, учетным данным, пейлоаду, стране..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Severity Filter Pills */}
        <div className="flex items-center gap-1.5">
          {[
            { key: 'all', label: 'Все' },
            { key: 'critical', label: 'Критический' },
            { key: 'high', label: 'Высокий' },
            { key: 'medium', label: 'Средний' },
            { key: 'low', label: 'Низкий' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSelectedSeverity(key)}
              className={`px-2.5 py-1 text-xs rounded-lg uppercase tracking-wider font-semibold transition-all cursor-pointer ${
                selectedSeverity === key
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Events Stream Table */}
      <div className="cyber-card rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Время</th>
                <th className="py-3 px-4">Критичность</th>
                <th className="py-3 px-4">Источник (IP)</th>
                <th className="py-3 px-4">Целевая ловушка / Порт</th>
                <th className="py-3 px-4">Протокол и тип</th>
                <th className="py-3 px-4">Детали IOC / Полезная нагрузка</th>
                <th className="py-3 px-4 text-right">Анализ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-sans">
                    Событий атак по текущему фильтру не обнаружено.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => {
                  return (
                    <tr
                      key={evt.id}
                      onClick={() => onSelectEvent(evt)}
                      className="hover:bg-slate-850/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                        {new Date(evt.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                        <div className="text-[10px] text-slate-500">
                          {new Date(evt.timestamp).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {getSeverityBadge(evt.severity)}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-amber-300 text-xs">
                          {evt.sourceIp}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 font-sans">
                          <GlobeIcon className="w-3 h-3 text-slate-500" />
                          <span>{evt.city ? `${evt.city}, ${evt.country}` : evt.country || 'Неизвестно'}</span>
                          {evt.asn && <span className="text-slate-600">({evt.asn})</span>}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-slate-200 font-sans font-medium text-xs">
                          {evt.agentName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Порт <span className="text-amber-400 font-bold">{evt.destPort}</span> ({evt.protocol})
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800 text-[11px]">
                          {evt.eventType.replace('_', ' ').toUpperCase()}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Тип ловушки: {evt.honeypotType}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-300 max-w-xs sm:max-w-md truncate">
                        {evt.details.username && (
                          <span className="text-amber-400 mr-2">
                            учетка: {evt.details.username}:{evt.details.password || '***'}
                          </span>
                        )}
                        {evt.details.command && (
                          <span className="text-purple-300 mr-2">
                            команда: {evt.details.command}
                          </span>
                        )}
                        {evt.details.url && (
                          <span className="text-sky-300 mr-2">
                            {evt.details.method || 'GET'} {evt.details.url}
                          </span>
                        )}
                        {evt.details.payload && (
                          <span className="text-slate-300">
                            {evt.details.payload}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right text-slate-500 group-hover:text-amber-400 transition-colors font-sans text-xs">
                        Подробнее →
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
