export const formatTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const fmt = (n: number, digits = 0) =>
  new Intl.NumberFormat('es-419', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);

export const percent = (x: number) => `${fmt(x * 100, 1)} %`;
