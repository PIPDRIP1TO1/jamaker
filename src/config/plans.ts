export const plans = {
  creator: {
    id: "creator-monthly",
    name: "JA MAKER Creator",
    priceUsd: 20,
    priceCents: 2000,
    currency: "USD" as const,
    interval: "month" as const,
  },
} as const;

export function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}
