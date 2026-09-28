'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { AttemptResult } from '@/lib/types';

export function ResultCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attemptId = searchParams.get('id');
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!attemptId) {
      router.push('/');
      return;
    }

    const stored = sessionStorage.getItem('lastResult');
    if (stored) {
      setResult(JSON.parse(stored));
      setLoading(false);
    } else {
      setError('Результат не найден');
      setLoading(false);
    }
  }, [attemptId, router]);

  const handleNewAttempt = () => {
    sessionStorage.removeItem('participant');
    sessionStorage.removeItem('lastResult');
    router.push('/');
  };

  if (loading) {
    return <div className="loading">Загрузка результата...</div>;
  }

  if (error || !result) {
    return (
      <div className="card">
        <div className="error">{error || 'Результат не найден'}</div>
        <button onClick={() => router.push('/')}>Вернуться на главную</button>
      </div>
    );
  }

  return (
    <div className="card">
      <h1 className="card-title">Результаты</h1>

      <div className="result-section">
        <p className="result-number">{result.percentage}%</p>
        <p className="result-label">Ваша оценка</p>

        <div className="result-details">
          <p style={{ margin: 0 }}>
            Вы правильно ответили на{' '}
            <strong>
              {result.score} из {result.total}
            </strong>{' '}
            вопросов
          </p>
        </div>

        <div className="button-group">
          <button onClick={handleNewAttempt}>Новая попытка</button>
        </div>
      </div>
    </div>
  );
}
