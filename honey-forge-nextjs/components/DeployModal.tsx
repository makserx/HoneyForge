'use client';

import React, { useState } from 'react';
import { HoneypotNode } from '@/lib/types';
import { TerminalIcon, CopyIcon, CheckCircleIcon, XCircleIcon, ShieldIcon } from './icons';

interface Props {
  node?: HoneypotNode | null;
  onClose: () => void;
}

export function DeployModal({ node, onClose }: Props) {
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [fallbackId] = useState(() => 'node_' + Math.random().toString(36).substring(2, 8));

  const serverUrl = typeof window !== 'undefined' ? window.location.origin : 'https://localhost:443';
  const agentId = node ? node.id : fallbackId;
  const maskName = node ? node.maskProcess : 'systemd-resolved';

  const pythonCommand = `python3 agent.py --server "${serverUrl}" --id "${agentId}" --mask "${maskName}"`;

  const systemdService = `[Unit]
Description=Network Name Resolution (Masked HoneyForge Agent)
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/python3 /opt/honeyforge/agent.py --server "${serverUrl}" --id "${agentId}" --mask "${maskName}"
Restart=always
RestartSec=10
StandardOutput=null
StandardError=null

[Install]
WantedBy=multi-user.target`;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="cyber-card p-6 rounded-2xl border border-slate-700 bg-slate-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <TerminalIcon className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white">
              Развёртывание скрытого агента-ловушки
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <XCircleIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Примечание по безопасности и скрытности */}
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-600/40 text-xs text-amber-200/90 flex items-start gap-3">
          <ShieldIcon className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Гарантия скрытности (MASK-4 и MASK-5):</span> Агент функционирует в оперативной памяти с маскировкой имени процесса под <code className="bg-black/40 px-1 py-0.5 rounded text-amber-300 font-mono">[{maskName}]</code>. Сетевое взаимодействие с сервером управления использует рандомизированный джиттер и замаскированные пути телеметрии (<code className="bg-black/40 px-1 py-0.5 rounded text-amber-300 font-mono">POST /api/v1/metrics/beacon</code>).
          </div>
        </div>

        {/* 1. Команда быстрого запуска */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Запуск через интерфейс командной строки (CLI)</span>
            {copiedType === 'py' && (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircleIcon className="w-3.5 h-3.5" /> Скопировано!
              </span>
            )}
          </div>
          <div className="relative group">
            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-amber-300 overflow-x-auto">
              {pythonCommand}
            </pre>
            <button
              onClick={() => copyToClipboard(pythonCommand, 'py')}
              className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer transition-colors"
              title="Скопировать команду"
            >
              <CopyIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Юнит службы Systemd */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>Служба автозапуска Linux Systemd (/etc/systemd/system/{maskName}.service)</span>
            {copiedType === 'systemd' && (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircleIcon className="w-3.5 h-3.5" /> Скопировано!
              </span>
            )}
          </div>
          <div className="relative group">
            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 max-h-44 overflow-y-auto">
              {systemdService}
            </pre>
            <button
              onClick={() => copyToClipboard(systemdService, 'systemd')}
              className="absolute right-2 top-2 p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer transition-colors"
              title="Скопировать юнит службы"
            >
              <CopyIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

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
