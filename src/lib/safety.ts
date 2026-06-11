// Client-side scam-signal detection for chat. This is a warning layer, not
// moderation — flagged phrases trigger an in-chat caution and easy reporting.
const SCAM_PATTERNS: RegExp[] = [
  /\bg[\s-]?cash\b/i,
  /\bwestern\s*union\b/i,
  /\bmoney\s*gram\b/i,
  /\b(wire|bank)\s*transfer\b/i,
  /\bsend\s+(me\s+)?(money|cash|funds|load)\b/i,
  /\bpadala\b/i,
  /\bremittance\b/i,
  /\b(bitcoin|btc|crypto|usdt|binance)\b/i,
  /\b(gift|steam|itunes|google\s*play)\s*card\b/i,
  /\bpaypal\.me\b/i,
  /\bhospital\s*(bill|fee)\b/i,
  /\bemergency\b.*\b(money|cash|funds|help me pay)\b/i,
  /\b(visa|travel|ticket|passport)\s*(fee|money|payment)\b/i,
  /\b(whats\s*app|telegram|viber|signal)\b/i,
];

export function hasScamSignals(text: string | undefined): boolean {
  if (!text) return false;
  return SCAM_PATTERNS.some((re) => re.test(text));
}
