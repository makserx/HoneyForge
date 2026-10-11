'use client';

import React, { useState } from 'react';
import { ShieldIcon, LockIcon, KeyIcon } from './icons';

interface Props {
  onSuccess: () => void;
}

export function OperatorLoginModal({ onSuccess }: Props) {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Введите токен доступа оператора');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/control/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        onSuccess();
      } else {
        setError(data?.error || 'Неверный токен доступа. Проверьте введённые данные.');
      }
    } catch {
      setError('Сетевая ошибка при связи с сервером управления');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillDefault = () => {
    setToken('honeyforge-secret-soc-2026');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Banner */}
        <div className="p-6 border-b border-slate-800 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <LockIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-wide">
                  Вход оператора SOC
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  FR-C5
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Контур управления платформой HoneyForge
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">
              Токен аутентификации (ADMIN_TOKEN)
            </label>
            <div className="relative">
              <input
                type="password"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Введите токен оператора..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500 transition-colors"
                autoFocus
              />
              <KeyIcon className="w-4 h-4 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Quick fill preset for development / demo */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between gap-2">
            <div>
              <span className="text-slate-300 font-medium">Демо-токен:</span>{' '}
              <code className="text-amber-400 font-mono text-[11px]">honeyforge-secret-soc-2026</code>
            </div>
            <button
              type="button"
              onClick={handleFillDefault}
              className="text-[11px] text-amber-400 hover:text-amber-300 hover:underline cursor-pointer shrink-0"
            >
              Вставить
            </button>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-lg text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
              ) : (
                <ShieldIcon className="w-4 h-4" />
              )}
              {isSubmitting ? 'Проверка токена...' : 'Войти в панель управления'}
            </button>
          </div>
        </form>

        {/* Footer info */}
        <div className="px-6 py-3 bg-slate-950/40 border-t border-slate-800/80 text-[11px] text-slate-500 text-center font-mono">
          Сессия оператора сохраняется в cookie <span className="text-slate-400">hf_session</span>
        </div>
      </div>
    </div>
  );
}
