'use client';

import React from 'react';
import { SystemStats, AttackEvent, HoneypotNode } from '@/lib/types';
import {
  ShieldIcon,
  ServerIcon,
  ActivityIcon,
  AlertTriangleIcon,
  ZapIcon,
  TerminalIcon,
  GlobeIcon,
} from './icons';

interface Props {
  stats: SystemStats;
  recentEvents: AttackEvent[];
  nodes: HoneypotNode[];
  onOpenDeployModal: () => void;
  onSimulateAttack: () => void;
  onNavigateToTab: (tab: 'feed' | 'nodes' | 'profiles') => void;
}

export function DashboardView({
  stats,
  recentEvents,
  onOpenDeployModal,
  onSimulateAttack,
  onNavigateToTab,
}: Props) {
  const maxVelocity = Math.max(...stats.recentVelocity.map((v) => v.count), 1);

  return (
    <div className="space-y-6">
      {/* Верхний баннер угроз */}
      <div className="cyber-card p-6 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/20 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Периметр активной защиты активен
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Децентрализованная сеть ловушек
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Матрица управления угрозами HoneyForge
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Архитектура децентрализованных ловушек. Приманки маскируются под продуктивные сервисы, а скрытые агенты перехватывают сканирование портов, брутфорс и эксплойты.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onSimulateAttack}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl shadow-lg shadow-amber-500/10 transition-all text-xs cursor-pointer"
            >
              <ZapIcon className="w-4 h-4" />
              Запустить тестовую атаку
            </button>
            <button
              onClick={onOpenDeployModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold rounded-xl border border-slate-700 transition-all text-xs cursor-pointer"
            >
              <TerminalIcon className="w-4 h-4" />
              Развернуть скрытый агент
            </button>
          </div>
        </div>
      </div>

      {/* Карточки 4 ключевых метрик KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Активные ноды */}
        <div
          onClick={() => onNavigateToTab('nodes')}
          className="cyber-card p-5 rounded-xl border border-slate-800 bg-slate-900/70 hover:border-amber-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Активный флот ловушек</span>
            <ServerIcon className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white font-mono">
              {stats.onlineNodes}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              / {stats.totalNodes} всего нод
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{Math.round((stats.onlineNodes / (stats.totalNodes || 1)) * 100)}% флота в строю</span>
          </div>
        </div>

        {/* Всего перехвачено атак */}
        <div
          onClick={() => onNavigateToTab('feed')}
          className="cyber-card p-5 rounded-xl border border-slate-800 bg-slate-900/70 hover:border-amber-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Всего перехвачено атак</span>
            <ActivityIcon className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-400 font-mono">
              {stats.totalEvents.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            <span className="text-amber-400 font-bold">+{stats.eventsLast24h}</span> атак за последние 24 часа
          </div>
        </div>

        {/* Критические эксплойты */}
        <div
          onClick={() => onNavigateToTab('feed')}
          className="cyber-card p-5 rounded-xl border border-slate-800 bg-slate-900/70 hover:border-rose-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Критические эксплойты и атаки</span>
            <AlertTriangleIcon className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-rose-400 font-mono">
              {stats.criticalEvents}
            </span>
            <span className="text-xs text-slate-400">критических IOC</span>
          </div>
          <div className="mt-3 text-xs text-rose-400/80 font-medium">
            Требуется анализ инцидентов
          </div>
        </div>

        {/* Протокол маскировки и джиттера */}
        <div
          onClick={() => onNavigateToTab('profiles')}
          className="cyber-card p-5 rounded-xl border border-slate-800 bg-slate-900/70 hover:border-amber-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Скрытые протоколы (MASK-4/5)</span>
            <ShieldIcon className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-sm font-bold text-slate-100 mt-1 font-mono">
            {stats.totalProfiles} активных профилей ловушек
          </div>
          <div className="mt-3 text-xs text-amber-300/80 flex items-center gap-1 font-mono">
            <span>Джиттер: ±20%</span>
            <span className="text-slate-600">•</span>
            <span>Маскировка: `systemd-resolved`</span>
          </div>
        </div>
      </div>

      {/* Основная сетка: график динамики атак и распределение по протоколам */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Левая колонка: временная шкала динамики атак */}
        <div className="lg:col-span-8 cyber-card p-6 rounded-xl border border-slate-800 bg-slate-900/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <ActivityIcon className="w-4 h-4 text-amber-400" />
                Скорость поступления атак (за 12 часов)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Частота и объём атак, зафиксированных всеми распределёнными ловушками.
              </p>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
              Автообновление через SSE
            </span>
          </div>

          {/* Столбчатая диаграмма */}
          <div className="h-44 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-slate-800/80">
            {stats.recentVelocity.map((bucket, idx) => {
              const heightPercent = Math.max(
                Math.round((bucket.count / maxVelocity) * 100),
                8
              );
              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center gap-2 h-full justify-end group"
                >
                  <div className="text-[10px] text-amber-300 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                    {bucket.count}
                  </div>
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full bg-gradient-to-t from-amber-600 to-amber-400 hover:from-amber-500 hover:to-amber-300 rounded-t transition-all"
                  />
                  <div className="text-[9px] text-slate-500 font-mono truncate w-full text-center">
                    {bucket.time}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Таблица последних перехваченных атак */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Последние перехваченные вторжения
              </span>
              <button
                onClick={() => onNavigateToTab('feed')}
                className="text-xs text-amber-400 hover:underline cursor-pointer"
              >
                Открыть всю ленту атак →
              </button>
            </div>

            <div className="space-y-1.5 font-mono text-xs">
              {recentEvents.slice(0, 4).map((evt) => (
                <div
                  key={evt.id}
                  className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        evt.severity === 'critical'
                          ? 'bg-rose-500'
                          : evt.severity === 'high'
                          ? 'bg-amber-500'
                          : 'bg-sky-500'
                      }`}
                    />
                    <span className="font-bold text-amber-300">{evt.sourceIp}</span>
                    <span className="text-slate-500">→</span>
                    <span className="text-slate-300">Порт {evt.destPort} ({evt.protocol})</span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-xs sm:max-w-md font-sans">
                    {evt.details.payload || evt.details.command || evt.eventType}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono whitespace-nowrap">
                    {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Правая колонка: протоколы и основные источники угроз */}
        <div className="lg:col-span-4 space-y-6">
          {/* Атакуемые протоколы */}
          <div className="cyber-card p-5 rounded-xl border border-slate-800 bg-slate-900/80 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Популярные протоколы и порты атак
            </h3>
            <div className="space-y-2.5">
              {stats.topProtocols.map((p, idx) => {
                const total = stats.totalEvents || 1;
                const pct = Math.round((p.count / total) * 100);
                return (
                  <div key={idx} className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-300 font-mono">
                      <span>{p.protocol}</span>
                      <span className="text-amber-400 font-bold">{p.count} атак ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                      <div
                        style={{ width: `${pct}%` }}
                        className="bg-amber-500 h-full rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Топ атакующих IP / субъектов угроз */}
          <div className="cyber-card p-5 rounded-xl border border-slate-800 bg-slate-900/80 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Топ IP-адресов атакующих
            </h3>
            <div className="space-y-2 font-mono text-xs">
              {stats.topAttackerIps.map((attacker, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-amber-300">{attacker.ip}</div>
                    <div className="text-[10px] text-slate-400 font-sans flex items-center gap-1">
                      <GlobeIcon className="w-3 h-3 text-slate-500" />
                      <span>{attacker.country || 'Неизвестная геопозиция'}</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-bold">
                    {attacker.count} атак
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
