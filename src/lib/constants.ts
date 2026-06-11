// Canonical support inbox — set up forwarding for this address at the domain
// registrar. The mobile app's legal pages should be updated to match.
export const SUPPORT_EMAIL = 'support@filipinawest.com';

export const INTEREST_OPTIONS = ['Family', 'Traveling', 'Cooking', 'Faith', 'Beaches', 'Hiking', 'Books', 'Movies', 'Music', 'Fitness'];

export const COUNTRY_OPTIONS = ['Philippines', 'United States', 'Canada', 'United Kingdom', 'Australia', 'Other'];

export const LOOKING_FOR_OPTIONS = ['Serious relationship', 'Marriage', 'Long-term partner', 'Getting to know people'];

// Canonical (English) values stored in Firestore; display labels come from
// the i18n option maps.
export const EDUCATION_OPTIONS = ['High school', 'College', "Bachelor's degree", "Master's or higher", 'Other'];
export const RELIGION_OPTIONS = ['Catholic', 'Christian', 'Iglesia ni Cristo', 'Muslim', 'Other', 'Prefer not to say'];
export const DRINKING_OPTIONS = ['Never', 'Socially', 'Often'];
export const SMOKING_OPTIONS = ['No', 'Sometimes', 'Yes'];
export const MAX_PHOTOS = 6;

export function reportMailto(memberId: string, memberName?: string): string {
  const subject = `Report member ${memberId}`;
  const body = `I want to report ${memberName || 'a member'} (member id: ${memberId}).\n\nReason:\n`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
