import { Suspense } from 'react';
import { ResultCard } from '@/components/ResultCard';

export default function ResultPage() {
  return (
    <main>
      <Suspense fallback={<div className="loading">�������� ����������...</div>}>
        <ResultCard />
      </Suspense>
    </main>
  );
}
