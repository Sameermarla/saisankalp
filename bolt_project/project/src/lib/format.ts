export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getEffectivePrice(price: number, salePrice: number | null): number {
  return salePrice !== null && salePrice < price ? salePrice : price;
}

export function generateOrderNumber(): string {
  const prefix = 'SS';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}
