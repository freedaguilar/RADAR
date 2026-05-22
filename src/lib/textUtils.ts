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
