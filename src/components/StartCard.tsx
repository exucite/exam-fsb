'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function StartCard() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [staticId, setStaticId] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim() || !staticId.trim()) {
      setError('Заполните все поля');
      return;
    }

    sessionStorage.setItem(
      'participant',
      JSON.stringify({ firstName, lastName, staticId })
    );
    router.push('/test');
  };

  return (
    <div className="entry">
      <div className="entry-head">
        <div className="entry-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="5" width="20" height="14" rx="3" />
            <circle cx="8" cy="10.5" r="2" />
            <path d="M5.2 16.2c.7-1.7 2-2.3 2.8-2.3s2.1.6 2.8 2.3" />
            <path d="M14 9.5h5M14 12.5h5M14 15.5h3" />
          </svg>
        </div>
        <h1 className="entry-title">Идентификация</h1>
        <p className="entry-subtitle">Служба Безопасности | Внутренний портал</p>
      </div>

      <div className="entry-card">
        <form onSubmit={submit} className="entry-form">
          {error && <div className="error">{error}</div>}

          <div className="entry-grid">
            <div className="form-group">
              <label htmlFor="firstName">Имя</label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoFocus
                placeholder="Ivan"
              />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Фамилия</label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ivanov"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="staticId">Статический ID</label>
            <div className="static-input">
              <span className="static-hash">#</span>
              <input
                id="staticId"
                type="text"
                inputMode="numeric"
                value={staticId}
                onChange={(e) => setStaticId(e.target.value)}
                placeholder="12345"
              />
            </div>
          </div>

          <button type="submit" className="entry-submit">
            <span>Приступить к тесту</span>
            <span className="entry-arrow">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="18"
                height="18"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </button>
        </form>
      </div>

      <div className="entry-footer">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2l8 3.5v5c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11v-5L12 2z" />
        </svg>
        <span>Доступ протоколируется</span>
      </div>
    </div>
  );
}
