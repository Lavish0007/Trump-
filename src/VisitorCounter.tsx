import { useEffect, useState } from 'react';

export function VisitorCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const incrementCounter = async () => {
      try {
        const response = await fetch('/api/counter');
        const data = await response.json();
        setCount(data.value);
      } catch (error) {
        console.error('Failed to fetch visitor count:', error);
        setCount(0);
      }
    };

    incrementCounter();
  }, []);

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg">
      <p className="text-sm">
        Visitors: <span className="font-bold">{count ?? 'Loading...'}</span>
      </p>
    </div>
  );
}
