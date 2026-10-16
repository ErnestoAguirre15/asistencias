export function csvCell(value) {
  let text = String(value ?? '');
  // Excel interpreta estos prefijos como fórmulas incluso dentro de comillas CSV.
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g,'""')}"`;
}
