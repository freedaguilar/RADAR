import { PriceRecord, Product } from "../types";

export function getOutdatedProducts(products: Product[], records: PriceRecord[]): Product[] {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().split('T')[0];

  const activeProducts = products.filter(p => p.active);
  const recentProductIds = new Set(
    records.filter(r => r.date >= cutoff).map(r => r.productId)
  );

  return activeProducts.filter(p => !recentProductIds.has(p.id));
}
