const REFERRAL_STORAGE_KEY = 'stayloop_referral_code';

export function buildReferralSignupUrl(referralCode: string, origin = window.location.origin): string {
  const params = new URLSearchParams({ ref: referralCode.toUpperCase() });
  return `${origin}/hosts?${params.toString()}`;
}

export function captureReferralFromSearch(search: string): string | null {
  const code = new URLSearchParams(search).get('ref')?.trim().toUpperCase();
  if (!code) return null;
  window.localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  return code;
}

export function getStoredReferralCode(): string {
  return window.localStorage.getItem(REFERRAL_STORAGE_KEY) || '';
}

export function clearStoredReferralCode() {
  window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
}
