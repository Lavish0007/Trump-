import { useEffect, useState } from 'react';

export function VisitorCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const incrementCounter = async () => {
      try {
        // Using countapi.xyz - completely free, no account needed
        const response = await fetch(
          'https://api.countapi.xyz/hit/trump-selector-app/visits'
        );
        const data = await response.json();
        setCount(data.value);
      } catch (error) {
        console.error('Failed to fetch visitor count:', error);
        // Show fallback if API fails
        setCount(null);
      }
    };

    incrementCounter();
  }, []);

  if (count === null) {
    return null; // Don't show anything if counter fails
  }

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg">
      <p className="text-sm">
        Visitors: <span className="font-bold">{count}</span>
      </p>
    </div>
  );
}
