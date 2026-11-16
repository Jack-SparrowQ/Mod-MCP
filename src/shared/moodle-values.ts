import { MoodleError } from '../domain/errors.js';

const entities: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü',
  ndash: '–', mdash: '—', hellip: '…', copy: '©', reg: '®',
};
export function htmlToText(html: string): string {
  const text = html.replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (!entity.startsWith('#')) return entities[entity] ?? match;
      const point = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point) : match;
    }).replace(/\s+/g, ' ').trim();
  const characters = Array.from(text);
  return characters.length > 500 ? characters.slice(0, 499).join('') + '…' : text;
}

export function unixToIso(value: number | null | undefined): string | null {
  if (value === undefined || value === null || value === 0) return null;
  if (!Number.isFinite(value) || value < 0) throw new MoodleError('OPERATION_FAILED');
  const date = new Date(value * 1000);
  if (!Number.isFinite(date.getTime())) throw new MoodleError('OPERATION_FAILED');
  return date.toISOString();
}
