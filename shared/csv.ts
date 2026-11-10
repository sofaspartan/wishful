/**
 * A small RFC 4180 CSV reader shared by the CSV importer (browser) and the
 * Brickfolio sync (server). Handles quoted fields, doubled quotes, newlines
 * inside quotes, CRLF line endings and a leading byte-order mark. Rows where
 * every cell is empty are dropped.
 */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const endRow = () => {
    row.push(cell);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    row = [];
    cell = '';
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"' && cell === '') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      endRow();
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length) endRow();
  return rows;
}

/** Comma unless the header line has more semicolons or tabs (spreadsheet exports in some regions). */
export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const commas = count(',');
  if (count('\t') > commas && count('\t') >= count(';')) return '\t';
  if (count(';') > commas) return ';';
  return ',';
}

/** Rows as objects keyed by lower-cased, trimmed header names. */
export function csvRecords(text: string): Array<Record<string, string>> {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return rows.map((r) => {
    const rec: Record<string, string> = {};
    keys.forEach((k, i) => {
      if (k) rec[k] = (r[i] ?? '').trim();
    });
    return rec;
  });
}
