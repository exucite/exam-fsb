'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data: any = await res.json();
        setError(data?.error ?? 'Ошибка входа');
        setLoading(false);
        return;
      }

      router.push('/admin/results');
    } catch (err) {
      setError('Ошибка сети');
      setLoading(false);
    }
  };

  return (
    <main>
      <div className="card">
        <h1 className="card-title">Вход администратора</h1>
        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoFocus
              placeholder="Введите пароль"
            />
          </div>
          <button type="submit" disabled={loading || !password}>
            {loading ? 'Проверка...' : 'Войти'}
          </button>
        </form>
      </div>
    </main>
  );
}
