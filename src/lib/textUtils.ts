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

/**
 * Parses JSON safely, especially robust against trailing conversational text or markdown.
 */
export function safeParseJSON(text: string): any {
  if (!text) return null;
  const trimmed = text.trim();
  
  // Try direct parse first
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    // If direct parse fails, try to locate JSON block(s)
  }

  // Find the first '{'
  const startIndex = trimmed.indexOf('{');
  if (startIndex === -1) {
    return null;
  }

  // Bracket depth algorithm to extract the first complete balance of `{}`
  let depth = 0;
  let inString = false;
  let escape = false;
  
  for (let i = startIndex; i < trimmed.length; i++) {
    const char = trimmed[i];
    
    if (escape) {
      escape = false;
      continue;
    }
    
    if (char === '\\') {
      escape = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          const candidate = trimmed.substring(startIndex, i + 1);
          try {
            return JSON.parse(candidate);
          } catch (e) {
            // Ignore parse failures inside the pairing loop and keep scanning
          }
        }
      }
    }
  }

  // Fallback 1: match start and end of all braces and try from largest to smallest
  const openingBraces: number[] = [];
  const closingBraces: number[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '{') openingBraces.push(i);
    if (trimmed[i] === '}') closingBraces.push(i);
  }

  for (const start of openingBraces) {
    for (let j = closingBraces.length - 1; j >= 0; j--) {
      const end = closingBraces[j];
      if (end > start) {
        const chunk = trimmed.substring(start, end + 1);
        try {
          return JSON.parse(chunk);
        } catch (err) {
          // Continue to next pair
        }
      }
    }
  }

  // Fallback 2: remove markdown ticks and clean
  const cleanMarkdown = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  
  try {
    return JSON.parse(cleanMarkdown);
  } catch (e) {
    const matches = cleanMarkdown.match(/\{[\s\S]*?\}/g);
    if (matches) {
       for (const m of matches) {
         try {
           return JSON.parse(m);
         } catch (x) {}
       }
    }
  }

  return null;
}

/**
 * Decodes metadata from a PriceRecord notes column if it was saved as pending.
 */
export function parsePriceRecordMeta(notes: string | undefined): {
  isPending: boolean;
  aiProductSuggested: string;
  aiPriceSuggested: number;
  originalNotes: string;
} {
  if (notes && notes.startsWith('__PENDING_METADATA__:')) {
    try {
      const jsonStr = notes.substring('__PENDING_METADATA__:'.length);
      const meta = JSON.parse(jsonStr);
      return {
        isPending: meta.status === 'pendente',
        aiProductSuggested: meta.aiProductSuggested || '',
        aiPriceSuggested: meta.aiPriceSuggested || 0,
        originalNotes: meta.originalNotes || ''
      };
    } catch (e) {
      return {
        isPending: false,
        aiProductSuggested: '',
        aiPriceSuggested: 0,
        originalNotes: notes
      };
    }
  }
  return {
    isPending: false,
    aiProductSuggested: '',
    aiPriceSuggested: 0,
    originalNotes: notes || ''
  };
}

/**
 * Encodes metadata for pending audit records.
 */
export function serializePendingMeta(aiProductSuggested?: string, aiPriceSuggested?: number, originalNotes?: string): string {
  const meta = {
    status: 'pendente',
    aiProductSuggested: aiProductSuggested || '',
    aiPriceSuggested: aiPriceSuggested || 0,
    originalNotes: originalNotes || ''
  };
  return `__PENDING_METADATA__:${JSON.stringify(meta)}`;
}


