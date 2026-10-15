'use client';

import React, { useState, useEffect } from 'react';
import { HoneypotNode, HoneypotProfile } from '@/lib/types';
import {
  ServerIcon,
  TrashIcon,
  CheckCircleIcon,
  TerminalIcon,
  SearchIcon,
  ZapIcon,
} from './icons';

interface Props {
  nodes: HoneypotNode[];
  profiles: HoneypotProfile[];
  onRefresh: () => void;
  onOpenDeployModal: (node?: HoneypotNode) => void;
}

export function NodesView({
  nodes,
  profiles,
  onRefresh,
  onOpenDeployModal,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNodeForProfile, setSelectedNodeForProfile] = useState<HoneypotNode | null>(null);
  const [chosenProfileId, setChosenProfileId] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  const filteredNodes = nodes.filter(
    (n) =>
      n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.profileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.tags.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const formatRelativeTime = (isoString: string): string => {
    const diff = Math.floor((now - new Date(isoString).getTime()) / 1000);
    if (diff < 5) return 'только что';
    if (diff < 60) return `${diff} сек назад`;
    if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
    return `${Math.floor(diff / 86400)} дн назад`;
  };

  const handleAssignProfile = async () => {
    if (!selectedNodeForProfile || !chosenProfileId) return;

    try {
      const res = await fetch(`/api/control/nodes/${selectedNodeForProfile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: chosenProfileId }),
      });

      if (res.ok) {
        setNotification(`Профиль обновлён для ${selectedNodeForProfile.name}`);
        setTimeout(() => setNotification(null), 3000);
        setSelectedNodeForProfile(null);
        onRefresh();
      }
    } catch {
      alert('Ошибка обновления профиля');
    }
  };

  const handleDeleteNode = async (node: HoneypotNode) => {
    if (!confirm(`Вы уверены, что хотите удалить ноду ${node.name}?`)) return;

    try {
      const res = await fetch(`/api/control/nodes/${node.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setNotification(`Нода ${node.name} удалена из флота`);
        setTimeout(() => setNotification(null), 3000);
        onRefresh();
      }
    } catch {
      alert('Ошибка при удалении ноды');
    }
  };

  return (
    <div className="space-y-6">
      {/* Панель заголовка */}
      <div className="cyber-card p-5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ServerIcon className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white tracking-wide">
              Флот ловушек и инвентарь нод (FR-C2)
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Мониторинг статуса в реальном времени, проверка маскировки и удалённая отправка конфигураций для активных нод-ловушек.
          </p>
        </div>
        <button
          onClick={() => onOpenDeployModal()}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-semibold rounded-lg shadow-md transition-all cursor-pointer text-sm"
        >
          <TerminalIcon className="w-4 h-4" />
          Развернуть новый агент
        </button>
      </div>

      {notification && (
        <div className="p-3 rounded-lg text-sm bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 shrink-0" />
          {notification}
        </div>
      )}

      {/* Поиск и сводка статистики */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Поиск по имени, IP, тегу..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            В сети: {nodes.filter((n) => n.status === 'online').length}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Деградация: {nodes.filter((n) => n.status === 'degraded').length}
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800/60 text-slate-400 border border-slate-700/60">
            <span className="w-2 h-2 rounded-full bg-rose-400" />
            Не в сети: {nodes.filter((n) => n.status === 'offline').length}
          </span>
        </div>
      </div>

      {/* Таблица нод */}
      <div className="cyber-card rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Нода / Хост</th>
                <th className="py-3 px-4">Статус и доступность</th>
                <th className="py-3 px-4">Сеть / IP</th>
                <th className="py-3 px-4">Маскировка (MASK-4)</th>
                <th className="py-3 px-4">Назначенный профиль</th>
                <th className="py-3 px-4 text-center">Перехвачено атак</th>
                <th className="py-3 px-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredNodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Нет нод-ловушек, соответствующих запросу.
                  </td>
                </tr>
              ) : (
                filteredNodes.map((node) => {
                  const isOnline = node.status === 'online';
                  const isDegraded = node.status === 'degraded';

                  return (
                    <tr
                      key={node.id}
                      className="hover:bg-slate-850/60 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-100 flex items-center gap-2">
                          {node.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          <span>{node.hostname}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-500">{node.os}</span>
                        </div>
                        {node.tags.length > 0 && (
                          <div className="flex gap-1 mt-1.5">
                            {node.tags.map((t, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.2 text-[9px] bg-slate-800 text-slate-400 rounded"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isOnline
                                ? 'bg-emerald-400 animate-pulse'
                                : isDegraded
                                ? 'bg-amber-400'
                                : 'bg-rose-500'
                            }`}
                          />
                          <span
                            className={`font-semibold uppercase tracking-wider text-[10px] ${
                              isOnline
                                ? 'text-emerald-400'
                                : isDegraded
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {node.status === 'online' ? 'В СЕТИ' : node.status === 'degraded' ? 'ДЕГРАДАЦИЯ' : 'НЕ В СЕТИ'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 font-mono">
                          Активность: {formatRelativeTime(node.lastSeen)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {node.ip}
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <span className="px-2 py-0.5 bg-slate-950 text-amber-300/90 border border-slate-800 rounded text-[11px]">
                          {node.maskProcess}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Джиттер: ±{node.jitterSeconds}с
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => {
                            setSelectedNodeForProfile(node);
                            setChosenProfileId(node.profileId);
                          }}
                          className="text-left group cursor-pointer"
                        >
                          <div className="text-slate-200 group-hover:text-amber-400 font-medium transition-colors">
                            {node.profileName}
                          </div>
                          <div className="text-[10px] text-amber-500/70 group-hover:underline">
                            Сменить профиль →
                          </div>
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className="font-mono font-bold text-amber-400 text-sm">
                          {node.stats.totalEvents}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onOpenDeployModal(node)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition-all cursor-pointer"
                            title="Скрипт развёртывания агента"
                          >
                            <TerminalIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteNode(node)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-all cursor-pointer"
                            title="Удалить ноду"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модальное окно смены профиля */}
      {selectedNodeForProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="cyber-card p-6 rounded-xl border border-slate-700 bg-slate-900 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ZapIcon className="w-4 h-4 text-amber-400" />
              Назначить профиль для {selectedNodeForProfile.name}
            </h3>
            <p className="text-xs text-slate-400">
              Агент применит этот профиль, скорректирует открытые порты, баннеры сервисов и маскировку при следующем сигнале маяка (heartbeat).
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Выберите профиль ловушки
              </label>
              <select
                value={chosenProfileId}
                onChange={(e) => setChosenProfileId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.interactionLevel === 'high' ? 'Высокий' : p.interactionLevel === 'medium' ? 'Средний' : 'Низкий'} - Порты: {p.ports.join(',')})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedNodeForProfile(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Отмена
              </button>
              <button
                onClick={handleAssignProfile}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer"
              >
                Обновить назначение
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
