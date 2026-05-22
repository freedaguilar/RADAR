/**
 * Utility functions for text processing, accent removal, and normalized search.
 */

export const removeAccents = (str: string): string => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const normalizeString = (str: string): string => {
  return removeAccents(str.toLowerCase().trim());
};

export const matchText = (text: string, search: string): boolean => {
  return normalizeString(text).includes(normalizeString(search));
};

export const cleanAndNormalize = (str: string): string => {
  if (!str) return "";
  // 1. Remove accents
  let normalized = removeAccents(str);
  // 2. Convert to lowercase
  normalized = normalized.toLowerCase();
  // 3. Remove punctuation like dots, hyphens, commas, etc., replacing them with spaces to avoid joining words incorrectly
  normalized = normalized.replace(/[-.,/#!$%^&*;:{}=\-_`~()?"']/g, " ");
  // 4. Collapse extra spaces and trim
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
};

// Simple Levenshtein distance implementation
export const levenshteinDistance = (a: string, b: string): number => {
  const tmp: number[][] = [];
  const alen = a.length;
  const blen = b.length;
  if (alen === 0) return blen;
  if (blen === 0) return alen;
  
  for (let i = 0; i <= alen; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= blen; j++) {
    tmp[0][j] = j;
  }
  
  for (let i = 1; i <= alen; i++) {
    for (let j = 1; j <= blen; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[alen][blen];
};

interface SearchableProduct {
  id: string;
  name: string;
  brand?: string;
  category: string;
  subcategory?: string;
  weight?: string;
  active?: boolean;
}

export interface RankedProductResult<T> {
  product: T;
  score: number;
}

export function searchAndRankProducts<T extends SearchableProduct>(
  products: T[],
  searchQuery: string
): T[] {
  if (!searchQuery) {
    return products;
  }

  const queryClean = cleanAndNormalize(searchQuery);
  const queryUltra = queryClean.replace(/\s+/g, "");
  const queryWords = queryClean.split(" ").filter(Boolean);

  if (queryWords.length === 0) {
    return products;
  }

  const results: RankedProductResult<T>[] = [];

  for (const product of products) {
    let score = 0;
    let matchedAll = true;

    // Define different levels of searchable texts
    const prodCleanName = cleanAndNormalize(product.name);
    const prodCleanBrand = product.brand ? cleanAndNormalize(product.brand) : "";
    const prodCleanCategory = cleanAndNormalize(product.category);
    const prodCleanSubcategory = product.subcategory ? cleanAndNormalize(product.subcategory) : "";
    const prodCleanWeight = product.weight ? cleanAndNormalize(product.weight) : "";

    // Comprehensive searchable text
    const fullText = `${prodCleanName} ${prodCleanBrand} ${prodCleanCategory} ${prodCleanSubcategory} ${prodCleanWeight}`.replace(/\s+/g, " ").trim();
    const fullTextUltra = fullText.replace(/\s+/g, "");
    const fullTextWords = fullText.split(" ").filter(Boolean);

    // Full query matches
    if (prodCleanName.startsWith(queryClean)) {
      score += 100;
    } else if (prodCleanName.includes(queryClean)) {
      score += 60;
    } else if (fullText.includes(queryClean)) {
      score += 40;
    } else if (fullTextUltra.includes(queryUltra)) {
      score += 30;
    }

    // Checking each word of the search query
    for (const qWord of queryWords) {
      let wordMatched = false;

      // 1. Exact or Substring match on any word
      if (fullText.includes(qWord)) {
        wordMatched = true;
        if (prodCleanName.includes(qWord)) {
          score += 15;
          if (prodCleanName.startsWith(qWord)) {
            score += 10;
          }
        } else {
          score += 8;
        }
      } 
      // 2. Ultra index lookup fallback if query combined words (e.g. "droetker" -> "dr oetker")
      else if (fullTextUltra.includes(qWord)) {
        wordMatched = true;
        score += 5;
      }
      // 3. Fuzzy match fallback
      else if (qWord.length >= 3) {
        let bestDistance = 999;
        for (const pWord of fullTextWords) {
          if (Math.abs(pWord.length - qWord.length) <= 2) {
            const dist = levenshteinDistance(qWord, pWord);
            if (dist < bestDistance) {
              bestDistance = dist;
            }
          }
        }

        const allowedTypo = qWord.length >= 6 ? 2 : 1;
        if (bestDistance <= allowedTypo) {
          wordMatched = true;
          score += (allowedTypo - bestDistance + 1) * 3;
        }
      }

      if (!wordMatched) {
        matchedAll = false;
        break;
      }
    }

    if (matchedAll) {
      results.push({ product, score });
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .map(r => r.product);
}
