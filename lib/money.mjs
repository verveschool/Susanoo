export function money(paise) {
  const amount = BigInt(paise);
  const absolute = amount < 0n ? -amount : amount;
  const units = new Intl.NumberFormat('en-IN').format(absolute / 100n);
  const remainder = absolute % 100n;
  return `${amount < 0n ? '−' : ''}₹${units}${remainder ? '.' + String(remainder).padStart(2, '0') : ''}`;
}
