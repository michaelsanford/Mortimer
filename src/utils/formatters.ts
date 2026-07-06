export function cadCurrencyTooltipLabel(context: { dataset: { label?: string }; parsed: { y: number | null } }): string {
  let label = context.dataset.label || '';
  if (label) label += ': ';
  if (context.parsed.y !== null) {
    label += new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(context.parsed.y);
  }
  return label;
}
