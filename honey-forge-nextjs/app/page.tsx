'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  SystemStats,
  HoneypotNode,
  HoneypotProfile,
  AttackEvent,
} from '@/lib/types';
import { DashboardView } from '@/components/DashboardView';
import { NodesView } from '@/components/NodesView';
import { ProfileConstructorView } from '@/components/ProfileConstructorView';
import { AttackFeedView } from '@/components/AttackFeedView';
import { DeployModal } from '@/components/DeployModal';
import { EventDetailModal } from '@/components/EventDetailModal';
import { OperatorLoginModal } from '@/components/OperatorLoginModal';
import {
  ShieldIcon,
  ServerIcon,
  SlidersIcon,
  ActivityIcon,
  ZapIcon,
  RefreshCwIcon,
  LockIcon,
} from '@/components/icons';

type ActiveTab = 'dashboard' | 'nodes' | 'profiles' | 'feed';

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [nodes, setNodes] = useState<HoneypotNode[]>([]);
  const [profiles, setProfiles] = useState<HoneypotProfile[]>([]);
  const [events, setEvents] = useState<AttackEvent[]>([]);
  const [sseStatus, setSseStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [inspectEvent, setInspectEvent] = useState<AttackEvent | null>(null);
  const [deployModalNode, setDeployModalNode] = useState<HoneypotNode | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  // Fetch initial REST data
  const loadInitialData = useCallback(async () => {
    try {
      const [resStatsRaw, resNodesRaw, resProfilesRaw, resEventsRaw] = await Promise.all([
        fetch('/api/control/stats'),
        fetch('/api/control/nodes'),
        fetch('/api/control/profiles'),
        fetch('/api/control/events?limit=100'),
      ]);

      if (
        resStatsRaw.status === 401 ||
        resNodesRaw.status === 401 ||
        resProfilesRaw.status === 401 ||
        resEventsRaw.status === 401
      ) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      const [resStats, resNodes, resProfiles, resEvents] = await Promise.all([
        resStatsRaw.json(),
        resNodesRaw.json(),
        resProfilesRaw.json(),
        resEventsRaw.json(),
      ]);

      setIsAuthenticated(true);
      if (resStats && !resStats.error) setStats(resStats);
      if (resNodes?.nodes) setNodes(resNodes.nodes);
      if (resProfiles?.profiles) setProfiles(resProfiles.profiles);
      if (resEvents?.events) setEvents(resEvents.events);
    } catch (err) {
      console.error('[Dashboard] Error fetching initial data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check operator authentication status on startup
  useEffect(() => {
    let ignore = false;
    const checkAndLoad = async () => {
      try {
        const authRes = await fetch('/api/control/auth');
        const authData = await authRes.json().catch(() => ({ authenticated: false }));
        if (ignore) return;
        if (!authData?.authenticated) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }
        setIsAuthenticated(true);
        loadInitialData();
      } catch {
        if (!ignore) {
          setIsAuthenticated(false);
          setIsLoading(false);
        }
      }
    };

    checkAndLoad();

    return () => {
      ignore = true;
    };
  }, [loadInitialData]);

  // Connect to SSE Server-Sent Events stream for real-time attack alerts
  useEffect(() => {
    if (!isAuthenticated) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      setSseStatus('connecting');
      eventSource = new EventSource('/api/control/stream');

      eventSource.onopen = () => {
        setSseStatus('connected');
      };

      eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);

          if (payload.type === 'attack_event') {
            const newEvt: AttackEvent = payload.data;
            setEvents((prev) => [newEvt, ...prev.slice(0, 199)]);
            // Update stats
            setStats((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                totalEvents: prev.totalEvents + 1,
                eventsLast24h: prev.eventsLast24h + 1,
                criticalEvents:
                  newEvt.severity === 'critical' ? prev.criticalEvents + 1 : prev.criticalEvents,
              };
            });
          } else if (payload.type === 'attack_batch') {
            const batch: AttackEvent[] = payload.data;
            setEvents((prev) => [...batch, ...prev].slice(0, 200));
            setStats((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                totalEvents: prev.totalEvents + batch.length,
                eventsLast24h: prev.eventsLast24h + batch.length,
              };
            });
          } else if (payload.type === 'node_update') {
            const updatedNode: HoneypotNode = payload.data;
            setNodes((prev) => {
              const idx = prev.findIndex((n) => n.id === updatedNode.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = updatedNode;
                return next;
              }
              return [updatedNode, ...prev];
            });
          }
        } catch (err) {
          console.error('[SSE Client] Error parsing event:', err);
        }
      };

      eventSource.onerror = () => {
        setSseStatus('disconnected');
        if (eventSource) {
          eventSource.close();
        }
        // Attempt reconnect after 5s
        reconnectTimer = setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [isAuthenticated]);

  // Simulate Attack Action
  const handleSimulateAttack = async () => {
    try {
      const res = await fetch('/api/control/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        // Attack is broadcast via SSE automatically
      }
    } catch {
      console.error('Failed to trigger simulation');
    }
  };

  // Clear Event Logs
  const handleClearEvents = async () => {
    if (!confirm('Вы уверены, что хотите очистить журнал атак?')) return;
    try {
      await fetch('/api/control/events', { method: 'DELETE' });
      setEvents([]);
      loadInitialData();
    } catch {
      alert('Ошибка при очистке журнала');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/control/auth', { method: 'DELETE' });
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
    setSseStatus('disconnected');
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    setIsLoading(true);
    loadInitialData();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Cyber Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/85 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black">
              <ShieldIcon className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-wider text-white">
                  HONEY<span className="text-amber-400">FORGE</span>
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  MVP v1.0
                </span>
              </div>
              <div className="text-[10px] text-slate-400 hidden sm:block">
                Децентрализованная матрица управления флотом ловушек
              </div>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ActivityIcon className="w-3.5 h-3.5" />
              Дашборд
            </button>
            <button
              onClick={() => setActiveTab('nodes')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'nodes'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ServerIcon className="w-3.5 h-3.5" />
              Ловушки ({nodes.length})
            </button>
            <button
              onClick={() => setActiveTab('profiles')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'profiles'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <SlidersIcon className="w-3.5 h-3.5" />
              Профили ({profiles.length})
            </button>
            <button
              onClick={() => setActiveTab('feed')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'feed'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Атаки онлайн ({events.length})
            </button>
          </nav>

          {/* Right System Indicators */}
          <div className="flex items-center gap-3">
            {/* Live SSE Status */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
                sseStatus === 'connected'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                  : sseStatus === 'connecting'
                  ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                  : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
              }`}
              title="Трансляция событий в реальном времени (SSE)"
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
              <span className="hidden sm:inline">
                {sseStatus === 'connected' ? 'SSE ОНЛАЙН' : sseStatus === 'connecting' ? 'ПОДКЛЮЧЕНИЕ' : 'ОТКЛЮЧЕНО'}
              </span>
            </div>

            <button
              onClick={handleSimulateAttack}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer"
              title="Запустить тестовую атаку на ловушку"
            >
              <ZapIcon className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Тест атаки</span>
            </button>

            <button
              onClick={loadInitialData}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Обновить данные"
            >
              <RefreshCwIcon className="w-4 h-4" />
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer text-xs"
              title="Завершить сессию оператора SOC"
            >
              <LockIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Выйти</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="flex md:hidden border-t border-slate-800/80 px-2 py-1.5 justify-around bg-slate-900/60 text-xs">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-2.5 py-1 rounded ${activeTab === 'dashboard' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
          >
            Дашборд
          </button>
          <button
            onClick={() => setActiveTab('nodes')}
            className={`px-2.5 py-1 rounded ${activeTab === 'nodes' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
          >
            Ловушки ({nodes.length})
          </button>
          <button
            onClick={() => setActiveTab('profiles')}
            className={`px-2.5 py-1 rounded ${activeTab === 'profiles' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
          >
            Профили
          </button>
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-2.5 py-1 rounded ${activeTab === 'feed' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}
          >
            Атаки ({events.length})
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading || !stats ? (
          <div className="flex flex-col items-center justify-center h-80 space-y-4">
            <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-400 font-mono">
              Инициализация матрицы ловушек HoneyForge...
            </p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                stats={stats}
                recentEvents={events}
                nodes={nodes}
                onOpenDeployModal={() => setDeployModalNode(null)}
                onSimulateAttack={handleSimulateAttack}
                onNavigateToTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'nodes' && (
              <NodesView
                nodes={nodes}
                profiles={profiles}
                onRefresh={loadInitialData}
                onOpenDeployModal={(node) => setDeployModalNode(node || null)}
              />
            )}

            {activeTab === 'profiles' && (
              <ProfileConstructorView
                profiles={profiles}
                onRefresh={loadInitialData}
              />
            )}

            {activeTab === 'feed' && (
              <AttackFeedView
                events={events}
                sseStatus={sseStatus}
                onClearEvents={handleClearEvents}
                onSimulateAttack={handleSimulateAttack}
                onSelectEvent={(evt) => setInspectEvent(evt)}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      {deployModalNode !== undefined && (
        <DeployModal
          node={deployModalNode}
          onClose={() => setDeployModalNode(undefined)}
        />
      )}

      {inspectEvent && (
        <EventDetailModal
          event={inspectEvent}
          onClose={() => setInspectEvent(null)}
        />
      )}

      {!isAuthenticated && (
        <OperatorLoginModal onSuccess={handleLoginSuccess} />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        Система защиты HoneyForge • Централизованное управление ловушками • Режимы MASK-2 / MASK-4 / MASK-5 активны
      </footer>
    </div>
  );
}
