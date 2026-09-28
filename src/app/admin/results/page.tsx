'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminResultRow } from '@/lib/types';
import { apiFetch } from '@/lib/api';

interface AdminStats {
  todayCount: number;
  weekCount: number;
  monthCount: number;
  totalCount: number;
  uniqueParticipants: number;
  avgPercentage: number;
  last24h: { date: string; count: number; avgPercentage: number }[];
}

export default function AdminResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState<AdminResultRow[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [resetId, setResetId] = useState('');
  const [resetState, setResetState] = useState<
    { kind: 'success' | 'error'; text: string } | null
  >(null);
  const [resetting, setResetting] = useState(false);

  const handleResetCooldown = async () => {
    const staticId = resetId.trim();
    if (!staticId) {
      setResetState({ kind: 'error', text: 'Введите Static ID' });
      return;
    }
    setResetting(true);
    setResetState(null);
    try {
      const res = await apiFetch('admin/reset-cooldown.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staticId }),
      });
      const data: any = await res.json().catch(() => null);
      if (!res.ok) {
        setResetState({
          kind: 'error',
          text: data?.error ?? 'Не удалось сбросить кулдаун',
        });
        return;
      }
      setResetState({
        kind: 'success',
        text: `Кулдаун для #${data.staticId} сброшен — попытка доступна немедленно`,
      });
      setResetId('');
    } catch {
      setResetState({ kind: 'error', text: 'Ошибка сети' });
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    const loadStats = async () => {
      try {
        const res = await apiFetch('admin/stats.php');
        if (res.status === 401) {
          router.push('/admin/login');
          return;
        }
        if (res.ok) {
          const data: any = await res.json();
          setStats(data);
        }
      } catch {
        // статистика не критична — таблица важнее
      }
    };
    loadStats();
  }, [router]);

  useEffect(() => {
    const load = async () => {
      try {
        const query = search ? `?q=${encodeURIComponent(search)}` : '';
        const res = await apiFetch(`admin/results.php${query}`);

        if (res.status === 401) {
          router.push('/admin/login');
          return;
        }

        if (!res.ok) {
          const data: any = await res.json();
          setError(data?.error ?? 'Не удалось загрузить результаты');
          return;
        }

        const data: any = await res.json();
        setResults(data.results ?? []);
      } catch (err) {
        setError('Ошибка сети');
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, router]);

  const handleLogout = async () => {
    await apiFetch('admin/logout.php', { method: 'POST' });
    router.push('/admin/login');
  };

  const handleExport = async () => {
    try {
      const res = await apiFetch('admin/export.php');
      if (!res.ok) {
        setError('Не удалось скачать CSV');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `results-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError('Ошибка при скачивании');
    }
  };

  return (
    <main>
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '32px',
          }}
        >
          <h1 className="card-title" style={{ margin: 0 }}>
            Результаты
          </h1>
          <button
            onClick={handleLogout}
            className="button-secondary"
            style={{ padding: '12px 24px' }}
          >
            Выход
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {stats && (
          <div className="stats-grid">
            <div className="stat-tile">
              <div className="stat-value">{stats.todayCount}</div>
              <div className="stat-label">Тестов сегодня</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{stats.weekCount}</div>
              <div className="stat-label">За 7 дней</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{stats.monthCount}</div>
              <div className="stat-label">За 30 дней</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{stats.totalCount}</div>
              <div className="stat-label">Всего попыток</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{stats.uniqueParticipants}</div>
              <div className="stat-label">Уникальных Static ID</div>
            </div>
            <div className="stat-tile">
              <div className="stat-value">{stats.avgPercentage}%</div>
              <div className="stat-label">Средний результат</div>
            </div>
          </div>
        )}

        <div className="reset-box">
          <div className="reset-box-title">Сброс кулдауна по Static ID</div>
          <div className="reset-row">
            <input
              type="text"
              placeholder="Static ID участника"
              value={resetId}
              onChange={(e) => setResetId(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !resetting) handleResetCooldown();
              }}
              disabled={resetting}
            />
            <button
              onClick={handleResetCooldown}
              className={resetState?.kind === 'success' ? 'button-success' : 'button-danger'}
              disabled={resetting}
            >
              {resetting ? 'Сброс...' : 'Сбросить кулдаун'}
            </button>
          </div>
          {resetState && (
            <div className={resetState.kind === 'success' ? 'success' : 'error'} style={{ marginTop: '12px', marginBottom: 0 }}>
              {resetState.text}
            </div>
          )}
          <div className="reset-hint">
            Снимает часовую блокировку для всех браузеров, привязанных к этому Static ID. Таблица
            результатов не изменяется.
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="search">Поиск</label>
          <input
            id="search"
            type="text"
            placeholder="Имя, фамилия или Static ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : results.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px' }}>
            Результатов не найдено
          </p>
        ) : (
          <>
            {stats && (
              <div className="stats-chart">
                <div className="stats-chart-title">Активность за 24 часа</div>
                <div className="stats-bars">
                  {stats.last24h.map((bucket) => {
                    const max = Math.max(...stats.last24h.map((b) => b.count), 1);
                    return (
                      <div key={bucket.date} className="stats-bar-col">
                        <div
                          className="stats-bar"
                          style={{ height: `${(bucket.count / max) * 100}%` }}
                          title={`${bucket.date}:00 — ${bucket.count} попыток`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="stats-chart-legend">по часам (последние 24 ч)</div>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Фамилия</th>
                    <th>Имя</th>
                    <th>Static ID</th>
                    <th>Баллы</th>
                    <th>Всего</th>
                    <th>%</th>
                    <th>Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row) => (
                    <tr key={row.attemptId}>
                      <td>{row.lastName}</td>
                      <td>{row.firstName}</td>
                      <td>{row.staticId}</td>
                      <td>{row.score}</td>
                      <td>{row.total}</td>
                      <td>{row.percentage}%</td>
                      <td>{new Date(row.createdAt).toLocaleString('ru-RU')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={handleExport} style={{ marginTop: '24px', width: '100%' }}>
              Скачать CSV
            </button>
          </>
        )}
      </div>
    </main>
  );
}
