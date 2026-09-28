'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PublicQuestion } from '@/lib/types';
import { apiFetch } from '@/lib/api';

export function TestForm() {
  const router = useRouter();
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number | null>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [cooldownDeadline, setCooldownDeadline] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const [participant, setParticipant] = useState<{
    firstName?: string;
    lastName?: string;
    staticId?: string;
  }>({});

  useEffect(() => {
    const stored = sessionStorage.getItem('participant');
    const parsed = stored ? JSON.parse(stored) : {};
    setParticipant(parsed);

    if (!parsed.firstName) {
      router.push('/');
      return;
    }

    const load = async () => {
      try {
        const res = await apiFetch(
          `questions.php?staticId=${encodeURIComponent(parsed.staticId ?? '')}`
        );
        if (res.status === 403) {
          const data: any = await res.json();
          setBlocked(true);
          setError(data?.error ?? 'Доступ к тесту закрыт');
          if (typeof data?.retryAfterMs === 'number' && data.retryAfterMs > 0) {
            setCooldownDeadline(Date.now() + data.retryAfterMs);
          }
          return;
        }
        if (!res.ok) {
          const data: any = await res.json();
          setError(data?.error ?? 'Не удалось загрузить вопросы');
          return;
        }
        const data: any = await res.json();
        setQuestions(data.questions ?? []);
        const initial: Record<number, null> = {};
        data.questions?.forEach((q: PublicQuestion) => {
          initial[q.id] = null;
        });
        setAnswers(initial);
      } catch (err) {
        setError('Ошибка сети');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router]);

  const handleAnswer = (questionId: number, optionId: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  // Live countdown while the test is locked by the cooldown.
  useEffect(() => {
    if (cooldownDeadline === null) return;
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [cooldownDeadline]);

  const formatCountdown = (msLeft: number): string => {
    const totalSeconds = Math.max(0, Math.ceil(msLeft / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
  };

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const maxScroll = doc.scrollHeight - window.innerHeight;
      setAtTop(window.scrollY < 40);
      setAtBottom(window.scrollY >= maxScroll - 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [loading]);

  const scrollToEdge = (direction: 'top' | 'bottom') => {
    window.scrollTo({
      top: direction === 'top' ? 0 : document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  };

  const answered = Object.values(answers).filter((v) => v !== null).length;
  const progress = questions.length > 0 ? (answered / questions.length) * 100 : 0;

  const handleSubmit = async () => {
    setModalOpen(true);
  };

  const confirmSubmit = async () => {
    setModalOpen(false);

    const payload = {
      participant,
      answers: questions.map((q) => ({
        questionId: q.id,
        optionId: answers[q.id] ?? null,
      })),
    };

    setSubmitting(true);
    try {
      const res = await apiFetch('submit.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data: any = await res.json();
        if (res.status === 429) {
          setBlocked(true);
          setError(data?.error ?? 'Не удалось отправить ответы');
          if (typeof data?.retryAfterMs === 'number' && data.retryAfterMs > 0) {
            setCooldownDeadline(Date.now() + data.retryAfterMs);
          }
        } else {
          setError(data?.error ?? 'Не удалось отправить ответы');
        }
        setSubmitting(false);
        return;
      }

      const data: any = await res.json();
      sessionStorage.setItem('lastResult', JSON.stringify(data));
      router.push(`/result?id=${data.attemptId}`);
    } catch (err) {
      setError('Ошибка сети');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка вопросов...</div>;
  }

  if (error) {
    if (blocked) {
      const msLeft = cooldownDeadline !== null ? cooldownDeadline - nowMs : null;
      return (
        <div className="card cooldown-block">
          <div className="cooldown-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="cooldown-title">Доступ закрыт</h1>
          <p className="cooldown-text">
            Тест уже был пройден с этого браузера. Повторная попытка станет
            доступна через:
          </p>
          {msLeft !== null && msLeft > 0 && (
            <div className="cooldown-countdown">{formatCountdown(msLeft)}</div>
          )}
          <button className="button-secondary" onClick={() => router.push('/')}>
            Вернуться на главную
          </button>
        </div>
      );
    }

    return (
      <div className="card">
        <div className="error">{error}</div>
        <button onClick={() => router.push('/')}>Вернуться на главную</button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="card">
        <div className="error">Тесты отсутствуют или недоступны</div>
        <button onClick={() => router.push('/')}>Вернуться на главную</button>
      </div>
    );
  }

  return (
    <>
      <div className="card card-test">
        <div className="test-header">
        <div className="test-header-main">
          <h1 className="card-title">Итоговый тест</h1>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-text">
            Ответы на {answered} из {questions.length} вопросов
          </div>
        </div>

        <div className="test-header-submit">
          <button onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? 'Отправка...'
              : `Отправить ответы (${answered} из ${questions.length})`}
          </button>
          {answered < questions.length && !submitting && (
            <div className="submit-hint">
              Неотвеченные вопросы будут засчитаны как неправильные
            </div>
          )}
        </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {questions.map((question, index) => (
        <div key={question.id} className="question-group">
          <div className="question-text">
            {index + 1}. {question.text}
          </div>
          <ul className="options-list">
            {question.options.map((option) => (
              <li key={option.id} className="option-item">
                <label className="radio-wrapper">
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    checked={answers[question.id] === option.id}
                    onChange={() => {
                      handleAnswer(question.id, option.id);
                      setError('');
                    }}
                    disabled={submitting}
                  />
                  <span className="radio-label">{option.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="footer-submit">
        <button onClick={handleSubmit} disabled={submitting}>
          {submitting
            ? 'Отправка...'
            : `Отправить ответы (${answered} из ${questions.length})`}
        </button>
        {answered < questions.length && !submitting && (
          <div className="submit-hint">
            Неотвеченные вопросы будут засчитаны как неправильные
          </div>
        )}
      </div>

      {!loading && !error && questions.length > 0 && !atBottom && (
        <button
          className="scroll-nav"
          aria-label="Прокрутить вниз"
          onClick={() => scrollToEdge('bottom')}
        >
          ↓
        </button>
      )}

      {!loading && !error && questions.length > 0 && atBottom && !atTop && (
        <button
          className="scroll-nav"
          aria-label="Прокрутить вверх"
          onClick={() => scrollToEdge('top')}
        >
          ↑
        </button>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">
              <span className="modal-icon-inner">?</span>
            </div>
            <h3 className="modal-title">Подтверждение отправки</h3>
            <p className="modal-subtitle">
              Проверьте данные перед завершением сеанса тестирования
            </p>

            <div className="modal-data">
              <div className="modal-row">
                <span className="modal-label">Имя</span>
                <span className="modal-value">{participant.firstName || '—'}</span>
              </div>
              <div className="modal-row">
                <span className="modal-label">Фамилия</span>
                <span className="modal-value">{participant.lastName || '—'}</span>
              </div>
              <div className="modal-row">
                <span className="modal-label">Static ID</span>
                <span className="modal-value modal-mono">#{participant.staticId || '—'}</span>
              </div>
              <div className="modal-divider" />
              <div className="modal-row">
                <span className="modal-label">Отвечено</span>
                <span className="modal-value">
                  {answered} из {questions.length}
                </span>
              </div>
              {answered < questions.length && (
                <div className="modal-warning">
                  Неотвеченные вопросы будут засчитаны как неправильные
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="button-secondary"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                Отмена
              </button>
              <button onClick={confirmSubmit} disabled={submitting}>
                {submitting ? 'Отправка...' : 'Подтвердить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
