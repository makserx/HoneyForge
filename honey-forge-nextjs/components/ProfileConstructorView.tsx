'use client';

import React, { useState } from 'react';
import { HoneypotProfile, HoneypotService, InteractionLevel, DecoyCredential } from '@/lib/types';
import { SlidersIcon, PlusIcon, TrashIcon, CheckCircleIcon, ZapIcon, KeyIcon } from './icons';

interface Props {
  profiles: HoneypotProfile[];
  onRefresh: () => void;
}

const PRESET_TEMPLATES: Array<Omit<HoneypotProfile, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    name: 'Ловушка Linux Bastion (Низкое взаимодействие)',
    description: 'Многопортовый эмулятор стандартного сервера Ubuntu со службами FTP, SSH и HTTP.',
    interactionLevel: 'low',
    honeypotType: 'emulator',
    ports: [21, 22, 80, 8080],
    services: [
      { port: 21, service: 'FTP', banner: '220 ProFTPD 1.3.5e Server (Debian)', enabled: true },
      { port: 22, service: 'SSH', banner: 'SSH-2.0-OpenSSH_8.4p1 Debian-5+deb11u1', enabled: true },
      { port: 80, service: 'HTTP', banner: 'Apache/2.4.51 (Debian) Server at localhost Port 80', enabled: true },
      { port: 8080, service: 'Proxy', banner: 'Squid/4.13 Proxy Server', enabled: true },
    ],
    decoyCredentials: [
      { username: 'root', password: 'password123', role: 'Администратор' },
      { username: 'admin', password: 'admin@2026', role: 'Служебный аккаунт' },
    ],
    agentConfig: {
      beaconIntervalSeconds: 15,
      jitterPercent: 20,
      maskProcessName: 'systemd-resolved',
      bufferLimit: 5000,
      logRotationMb: 25,
    },
  },
  {
    name: 'Ловушка IoT Камера / Роутер (Низкое взаимодействие)',
    description: 'Эмулирует оболочку BusyBox на Telnet и веб-интерфейс для перехвата ботнетов Mirai и IoT-червей.',
    interactionLevel: 'low',
    honeypotType: 'emulator',
    ports: [23, 80, 554],
    services: [
      { port: 23, service: 'Telnet', banner: 'BusyBox v1.22.1 built-in shell (ash)\nlogin: ', enabled: true },
      { port: 80, service: 'HTTP', banner: 'micro_httpd/0.5 (Boa/0.94.13)', enabled: true },
      { port: 554, service: 'RTSP', banner: 'RTSP/1.0 200 OK\r\nServer: HIKVISION Streaming Server\r\n', enabled: true },
    ],
    decoyCredentials: [
      { username: 'admin', password: 'admin', role: 'Шлюз IoT' },
      { username: 'default', password: 'password', role: 'Устройство' },
    ],
    agentConfig: {
      beaconIntervalSeconds: 10,
      jitterPercent: 30,
      maskProcessName: 'kworker/u2:0',
      bufferLimit: 4000,
      logRotationMb: 15,
    },
  },
  {
    name: 'Ловушка Кластер Баз Данных (Среднее взаимодействие)',
    description: 'Эмулирует уязвимые службы Redis, MySQL и PostgreSQL для перехвата перебора паролей и шифровальщиков.',
    interactionLevel: 'medium',
    honeypotType: 'emulator',
    ports: [3306, 6379, 5432],
    services: [
      { port: 3306, service: 'MySQL', banner: '5.7.35-log MySQL Community Server', enabled: true },
      { port: 6379, service: 'Redis', banner: '-ERR unknown command or NOAUTH Authentication required.', enabled: true },
      { port: 5432, service: 'PostgreSQL', banner: 'PostgreSQL 14.2 on x86_64-pc-linux-gnu', enabled: true },
    ],
    decoyCredentials: [
      { username: 'postgres', password: 'postgres', role: 'СУБД PostgreSQL' },
      { username: 'root', password: 'root', role: 'СУБД MySQL' },
    ],
    agentConfig: {
      beaconIntervalSeconds: 12,
      jitterPercent: 15,
      maskProcessName: 'rsyslogd',
      bufferLimit: 6000,
      logRotationMb: 30,
    },
  },
  {
    name: 'Интерактивный SSH Honeypot Cowrie (Среднее взаимодействие)',
    description: 'Интерактивный терминал с записью нажатий клавиш, сессий и загружаемого вредоносного ПО.',
    interactionLevel: 'medium',
    honeypotType: 'cowrie',
    ports: [2222, 2323],
    services: [
      { port: 2222, service: 'Cowrie SSH', banner: 'SSH-2.0-OpenSSH_7.9p1 Debian-10+deb10u2', enabled: true },
      { port: 2323, service: 'Cowrie Telnet', banner: 'Ubuntu 20.04 LTS\nlogin: ', enabled: true },
    ],
    decoyCredentials: [
      { username: 'root', password: 'toor', role: 'Суперпользователь' },
      { username: 'ubuntu', password: 'ubuntu', role: 'Системный оператор' },
    ],
    agentConfig: {
      beaconIntervalSeconds: 20,
      jitterPercent: 10,
      maskProcessName: 'cron',
      bufferLimit: 10000,
      logRotationMb: 50,
    },
  },
];

export function ProfileConstructorView({ profiles, onRefresh }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(profiles[0]?.id || null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const initialProfile = profiles.find((x) => x.id === selectedId) || profiles[0];

  // Form state
  const [name, setName] = useState(initialProfile?.name || '');
  const [description, setDescription] = useState(initialProfile?.description || '');
  const [interactionLevel, setInteractionLevel] = useState<InteractionLevel>(initialProfile?.interactionLevel || 'low');
  const [honeypotType, setHoneypotType] = useState<'emulator' | 'cowrie' | 'http_trap' | 'custom'>(initialProfile?.honeypotType || 'emulator');
  const [services, setServices] = useState<HoneypotService[]>(initialProfile?.services ? [...initialProfile.services] : []);
  const [decoyCredentials, setDecoyCredentials] = useState<DecoyCredential[]>(initialProfile?.decoyCredentials ? [...initialProfile.decoyCredentials] : []);
  const [newCredUser, setNewCredUser] = useState('');
  const [newCredPass, setNewCredPass] = useState('');
  const [newCredRole, setNewCredRole] = useState('');
  const [beaconInterval, setBeaconInterval] = useState(initialProfile?.agentConfig?.beaconIntervalSeconds || 15);
  const [jitterPercent, setJitterPercent] = useState(initialProfile?.agentConfig?.jitterPercent || 20);
  const [maskProcess, setMaskProcess] = useState(initialProfile?.agentConfig?.maskProcessName || 'systemd-resolved');
  const [bufferLimit, setBufferLimit] = useState(initialProfile?.agentConfig?.bufferLimit || 5000);
  const [newPortNum, setNewPortNum] = useState('');
  const [newPortService, setNewPortService] = useState('');
  const [newPortBanner, setNewPortBanner] = useState('');

  const [prevProfiles, setPrevProfiles] = useState(profiles);
  if (profiles !== prevProfiles) {
    setPrevProfiles(profiles);
    if (!isCreatingNew && (!selectedId || name === '')) {
      const p = profiles.find((x) => x.id === selectedId) || profiles[0];
      if (p) {
        setSelectedId(p.id);
        setName(p.name);
        setDescription(p.description);
        setInteractionLevel(p.interactionLevel);
        setHoneypotType(p.honeypotType);
        setServices([...p.services]);
        setDecoyCredentials(p.decoyCredentials ? [...p.decoyCredentials] : []);
        setBeaconInterval(p.agentConfig.beaconIntervalSeconds);
        setJitterPercent(p.agentConfig.jitterPercent);
        setMaskProcess(p.agentConfig.maskProcessName);
        setBufferLimit(p.agentConfig.bufferLimit);
      }
    }
  }

  // When profile is selected, populate form
  const handleSelectProfile = (p: HoneypotProfile) => {
    setSelectedId(p.id);
    setIsCreatingNew(false);
    setName(p.name);
    setDescription(p.description);
    setInteractionLevel(p.interactionLevel);
    setHoneypotType(p.honeypotType);
    setServices([...p.services]);
    setDecoyCredentials(p.decoyCredentials ? [...p.decoyCredentials] : []);
    setBeaconInterval(p.agentConfig.beaconIntervalSeconds);
    setJitterPercent(p.agentConfig.jitterPercent);
    setMaskProcess(p.agentConfig.maskProcessName);
    setBufferLimit(p.agentConfig.bufferLimit);
    setFeedbackMsg(null);
  };

  const handleStartNew = () => {
    setIsCreatingNew(true);
    setSelectedId(null);
    setName('Новый пользовательский профиль ловушки');
    setDescription('Индивидуальный профиль ловушки с настраиваемыми баннерами и триггерами портов.');
    setInteractionLevel('low');
    setHoneypotType('emulator');
    setServices([
      { port: 22, service: 'SSH', banner: 'SSH-2.0-OpenSSH_8.4p1 Debian-5+deb11u1', enabled: true },
      { port: 80, service: 'HTTP', banner: 'Apache/2.4.51 (Debian)', enabled: true },
    ]);
    setDecoyCredentials([
      { username: 'admin', password: 'password123', role: 'Администратор' },
      { username: 'support', password: 'support@2026', role: 'Служебный аккаунт' },
    ]);
    setBeaconInterval(15);
    setJitterPercent(20);
    setMaskProcess('systemd-resolved');
    setBufferLimit(5000);
    setFeedbackMsg(null);
  };

  const handleApplyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setName(preset.name);
    setDescription(preset.description);
    setInteractionLevel(preset.interactionLevel);
    setHoneypotType(preset.honeypotType);
    setServices([...preset.services]);
    setDecoyCredentials(preset.decoyCredentials ? [...preset.decoyCredentials] : []);
    setBeaconInterval(preset.agentConfig.beaconIntervalSeconds);
    setJitterPercent(preset.agentConfig.jitterPercent);
    setMaskProcess(preset.agentConfig.maskProcessName);
    setBufferLimit(preset.agentConfig.bufferLimit);
    showNotice(`Шаблон применён: ${preset.name}`, 'success');
  };

  const showNotice = (text: string, type: 'success' | 'error') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Service list manipulations
  const toggleService = (idx: number) => {
    const updated = [...services];
    updated[idx].enabled = !updated[idx].enabled;
    setServices(updated);
  };

  const removeService = (idx: number) => {
    setServices(services.filter((_, i) => i !== idx));
  };

  const addCustomPort = () => {
    const port = parseInt(newPortNum, 10);
    if (!port || port <= 0 || port > 65535) {
      showNotice('Укажите корректный номер порта (1 - 65535)', 'error');
      return;
    }
    if (services.some((s) => s.port === port)) {
      showNotice(`Порт ${port} уже настроен в этом профиле`, 'error');
      return;
    }

    setServices([
      ...services,
      {
        port,
        service: newPortService.trim() || 'Custom',
        banner: newPortBanner.trim() || `Служба готова на порту ${port}`,
        enabled: true,
      },
    ]);
    setNewPortNum('');
    setNewPortService('');
    setNewPortBanner('');
  };

  // Decoy credentials manipulations
  const removeCredential = (idx: number) => {
    setDecoyCredentials(decoyCredentials.filter((_, i) => i !== idx));
  };

  const addCredential = () => {
    if (!newCredUser.trim() || !newCredPass.trim()) {
      showNotice('Укажите логин и пароль приманки', 'error');
      return;
    }
    setDecoyCredentials([
      ...decoyCredentials,
      {
        username: newCredUser.trim(),
        password: newCredPass.trim(),
        role: newCredRole.trim() || 'Пользователь',
      },
    ]);
    setNewCredUser('');
    setNewCredPass('');
    setNewCredRole('');
  };

  // Save profile to API
  const handleSave = async () => {
    if (!name.trim()) {
      showNotice('Укажите название профиля', 'error');
      return;
    }

    const ports = services.filter((s) => s.enabled).map((s) => s.port);

    const payload = {
      name: name.trim(),
      description: description.trim(),
      interactionLevel,
      honeypotType,
      ports,
      services,
      decoyCredentials,
      agentConfig: {
        beaconIntervalSeconds: beaconInterval,
        jitterPercent,
        maskProcessName: maskProcess,
        bufferLimit,
        logRotationMb: 25,
      },
    };

    try {
      if (isCreatingNew || !selectedId) {
        const res = await fetch('/api/control/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          showNotice('Новый профиль ловушки успешно создан!', 'success');
          setIsCreatingNew(false);
          setSelectedId(data.profile.id);
          onRefresh();
        } else {
          showNotice('Не удалось создать профиль', 'error');
        }
      } else {
        const res = await fetch(`/api/control/profiles/${selectedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          showNotice('Профиль успешно обновлён! Подключенные агенты получат манифест при следующем сигнале маяка.', 'success');
          onRefresh();
        } else {
          showNotice('Не удалось обновить профиль', 'error');
        }
      }
    } catch {
      showNotice('Сетевая ошибка при сохранении профиля', 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm('Вы уверены, что хотите удалить этот профиль ловушки?')) return;

    try {
      const res = await fetch(`/api/control/profiles/${selectedId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showNotice('Профиль удалён', 'success');
        setSelectedId(profiles[0]?.id || null);
        onRefresh();
      } else {
        showNotice('Не удалось удалить профиль', 'error');
      }
    } catch {
      showNotice('Сетевая ошибка при удалении профиля', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Presets */}
      <div className="cyber-card p-5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <SlidersIcon className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white tracking-wide">
              Конструктор профилей ловушек (FR-C1)
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Создание профилей приманок, настройка открытых портов эмуляции, баннеров служб и параметров скрытого агента.
          </p>
        </div>
        <button
          onClick={handleStartNew}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-semibold rounded-lg shadow-md transition-all cursor-pointer text-sm"
        >
          <PlusIcon className="w-4 h-4" />
          Создать новый профиль
        </button>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 rounded-lg text-sm flex items-center gap-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
              : 'bg-rose-950/80 text-rose-300 border border-rose-800/80'
          }`}
        >
          <CheckCircleIcon className="w-4 h-4 shrink-0" />
          {feedbackMsg.text}
        </div>
      )}

      {/* Preset Fast Selector */}
      <div className="cyber-card p-4 rounded-xl border border-slate-800/80 bg-slate-900/40">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
          <ZapIcon className="w-3.5 h-3.5 text-amber-400" />
          Быстрый выбор шаблонов безопасности (пресеты)
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {PRESET_TEMPLATES.map((tmpl, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyPreset(tmpl)}
              className="text-left p-3 rounded-lg bg-slate-950/70 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-850 transition-all text-xs group cursor-pointer"
            >
              <div className="font-semibold text-slate-200 group-hover:text-amber-400 mb-1">
                {tmpl.name}
              </div>
              <div className="text-slate-400 line-clamp-2">{tmpl.description}</div>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-300/80 font-mono">
                <span>Порты: {tmpl.ports.join(', ')}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Existing Profiles List */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            Зарегистрированные профили ({profiles.length})
          </h3>
          <div className="space-y-2">
            {profiles.map((p) => {
              const isSelected = p.id === selectedId && !isCreatingNew;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectProfile(p)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-950/20 border-amber-500/60 shadow-lg shadow-amber-950/20'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-200">
                      {p.name}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        p.interactionLevel === 'high'
                          ? 'bg-purple-950 text-purple-300 border border-purple-800'
                          : p.interactionLevel === 'medium'
                          ? 'bg-sky-950 text-sky-300 border border-sky-800'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {p.interactionLevel === 'high' ? 'Высокий' : p.interactionLevel === 'medium' ? 'Средний' : 'Низкий'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {p.description}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Порты: {p.ports.join(', ') || 'Нет'}</span>
                    <span className="text-amber-400/80">
                      ~{p.agentConfig.maskProcessName}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Visual Constructor & Configuration Editor */}
        <div className="lg:col-span-8 cyber-card p-6 rounded-xl border border-slate-800 bg-slate-900/80 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                {isCreatingNew ? 'Создать новый профиль' : `Настройка: ${name}`}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                ID: {isCreatingNew ? 'генерация при сохранении' : selectedId}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {!isCreatingNew && (
                <button
                  onClick={handleDelete}
                  className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg border border-transparent hover:border-rose-800/60 transition-all cursor-pointer"
                  title="Удалить профиль"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-sm transition-all cursor-pointer"
              >
                <CheckCircleIcon className="w-4 h-4" />
                {isCreatingNew ? 'Создать профиль' : 'Сохранить изменения'}
              </button>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">
                Название профиля
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-medium"
                placeholder="Например: Сервер Linux Edge"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">
                Уровень взаимодействия
              </label>
              <select
                value={interactionLevel}
                onChange={(e) => setInteractionLevel(e.target.value as InteractionLevel)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500 font-medium"
              >
                <option value="low">Низкий (эмуляция портов и баннеров)</option>
                <option value="medium">Средний (интерактивный шелл / Cowrie)</option>
                <option value="high">Высокий (изолированная песочница)</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">
                Описание профиля
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                placeholder="Тактическое назначение конфигурации ловушки..."
              />
            </div>
          </div>

          {/* Emulated Ports & Services */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Матрица открытых служб и баннеров эмуляции
              </label>
              <span className="text-xs text-slate-400 font-mono">
                Активные порты: {services.filter((s) => s.enabled).map((s) => s.port).join(', ') || 'Нет'}
              </span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {services.map((srv, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${
                    srv.enabled
                      ? 'bg-slate-950/80 border-slate-700/80'
                      : 'bg-slate-950/30 border-slate-900 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 shrink-0">
                    <input
                      type="checkbox"
                      checked={srv.enabled}
                      onChange={() => toggleService(idx)}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                    <div className="w-16 font-mono font-bold text-amber-400 text-sm">
                      Порт {srv.port}
                    </div>
                    <div className="w-24 text-xs font-semibold text-slate-200">
                      {srv.service}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={srv.banner}
                    onChange={(e) => {
                      const updated = [...services];
                      updated[idx].banner = e.target.value;
                      setServices(updated);
                    }}
                    className="flex-1 w-full px-2.5 py-1 text-xs bg-slate-900 border border-slate-800 rounded font-mono text-slate-300 focus:outline-none focus:border-amber-500"
                    placeholder="Пользовательский баннер службы..."
                  />

                  <button
                    onClick={() => removeService(idx)}
                    className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer shrink-0"
                    title="Удалить службу"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Service Port */}
            <div className="mt-3 p-3 rounded-lg bg-slate-950/40 border border-dashed border-slate-800 flex flex-col sm:flex-row items-center gap-2">
              <input
                type="number"
                value={newPortNum}
                onChange={(e) => setNewPortNum(e.target.value)}
                placeholder="Порт (напр. 3389)"
                className="w-full sm:w-28 px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
              <input
                type="text"
                value={newPortService}
                onChange={(e) => setNewPortService(e.target.value)}
                placeholder="Служба (RDP, Redis...)"
                className="w-full sm:w-36 px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-500"
              />
              <input
                type="text"
                value={newPortBanner}
                onChange={(e) => setNewPortBanner(e.target.value)}
                placeholder="Баннер или приветствие..."
                className="w-full sm:flex-1 px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
              <button
                onClick={addCustomPort}
                className="w-full sm:w-auto px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer shrink-0"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Добавить порт
              </button>
            </div>
          </div>

          {/* Decoy Credentials (FR-C1, Honey-Tokens) */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                  <KeyIcon className="w-4 h-4 text-amber-400" />
                  Учётные данные-приманки (Honey-Credentials / Bait Logins)
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Фейковые учетные записи и пароли для отслеживания попыток компрометации и алертинга при входе (FR-C1).
                </p>
              </div>
              <span className="text-xs text-amber-400 font-mono">
                {decoyCredentials.length} активных пар
              </span>
            </div>

            {decoyCredentials.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500 bg-slate-950/40 rounded-lg border border-slate-800">
                Учётные записи-приманки не заданы. Добавьте фейковый логин и пароль ниже.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {decoyCredentials.map((cred, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-300 truncate">
                          {cred.username}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                          {cred.role || 'Пользователь'}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 truncate mt-0.5">
                        Пароль: <span className="text-slate-200">{cred.password}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeCredential(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer shrink-0"
                      title="Удалить приманку"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Credential Form */}
            <div className="mt-3 p-3 rounded-lg bg-slate-950/40 border border-dashed border-slate-800 flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                value={newCredUser}
                onChange={(e) => setNewCredUser(e.target.value)}
                placeholder="Логин (admin, root...)"
                className="w-full sm:w-36 px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
              <input
                type="text"
                value={newCredPass}
                onChange={(e) => setNewCredPass(e.target.value)}
                placeholder="Пароль (P@ssw0rd2026...)"
                className="w-full sm:w-44 px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
              />
              <input
                type="text"
                value={newCredRole}
                onChange={(e) => setNewCredRole(e.target.value)}
                placeholder="Роль/описание (Администратор, VPN...)"
                className="w-full sm:flex-1 px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={addCredential}
                className="w-full sm:w-auto px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer shrink-0"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                Добавить приманку
              </button>
            </div>
          </div>

          {/* Stealth & Agent Configuration (MASK-4, MASK-5, FR-A3) */}
          <div className="pt-4 border-t border-slate-800">
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ZapIcon className="w-4 h-4" />
              Параметры скрытого агента и защита от анализа (MASK-4 / MASK-5)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Интервал сигнала маяка (heartbeat): <span className="font-mono text-amber-400">{beaconInterval}с</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={beaconInterval}
                  onChange={(e) => setBeaconInterval(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500">Базовая частота опроса для `/api/v1/metrics/beacon`</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Окно сетевого джиттера: <span className="font-mono text-amber-400">±{jitterPercent}%</span>
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={jitterPercent}
                  onChange={(e) => setJitterPercent(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500">Рандомизация таймингов для обхода систем обнаружения аномалий (IDS/NDR)</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Маскировка имени процесса (MASK-4)
                </label>
                <select
                  value={maskProcess}
                  onChange={(e) => setMaskProcess(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                >
                  <option value="systemd-resolved">systemd-resolved (DNS-демон)</option>
                  <option value="kworker/u2:0">[kworker/u2:0] (Воркер ядра)</option>
                  <option value="rsyslogd">rsyslogd (Системный логгер)</option>
                  <option value="cron">cron / crond (Планировщик задач)</option>
                  <option value="svchost.exe">svchost.exe (Служба Windows)</option>
                </select>
                <span className="text-[10px] text-slate-500">Подменяет `argv[0]` и `prctl` в списке процессов ОС</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
