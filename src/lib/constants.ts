// Canonical support inbox — set up forwarding for this address at the domain
// registrar. The mobile app's legal pages should be updated to match.
export const SUPPORT_EMAIL = 'support@filipinawest.com';

export const INTEREST_OPTIONS = ['Family', 'Traveling', 'Cooking', 'Faith', 'Beaches', 'Hiking', 'Books', 'Movies', 'Music', 'Fitness'];

export const COUNTRY_OPTIONS = ['Philippines', 'United States', 'Canada', 'United Kingdom', 'Australia', 'Other'];

export const LOOKING_FOR_OPTIONS = ['Serious relationship', 'Marriage', 'Long-term partner', 'Getting to know people'];

export function reportMailto(memberId: string, memberName?: string): string {
  const subject = `Report member ${memberId}`;
  const body = `I want to report ${memberName || 'a member'} (member id: ${memberId}).\n\nReason:\n`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
