export const budgets = ['Not Sure', 'USD $0 - $100', 'USD $100 - $500', 'USD $500 - $1,000', 'USD $1,000 - $2,500', 'USD $2,500 - $5,000', 'USD $5,000 - $10,000', 'USD $10,000 - $25,000', 'More Than USD $25,000'];
export const referrals = ['Google Search', 'Social Media', 'Recommendation', 'Other'];
export const limits = { firstName: 80, lastName: 80, email: 254, phone: 40, country: 80, company: 120, website: 2048, industry: 120, message: 5000 };
export function validateFields(values) {
  const errors = {};
  for (const [field, max] of Object.entries(limits)) {
    const value = String(values[field] || '').trim();
    if (value.length > max) errors[field] = `Use at most ${max} characters.`;
    if (field !== 'message' && /[\r\n\x00-\x1f\x7f]/.test(value)) errors[field] = 'Remove invalid control characters.';
  }
  for (const field of ['firstName', 'lastName', 'email', 'message']) if (!String(values[field] || '').trim()) errors[field] = 'This field is required.';
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (values.message?.trim() && values.message.trim().length < 10) errors.message = 'Please enter at least 10 characters.';
  if (values.website?.trim()) {
    try { const url = new URL(values.website); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw Error(); }
    catch { errors.website = 'Enter a full website URL, for example https://example.com.'; }
  }
  return errors;
}

export function requestId() {
  if (globalThis.crypto.randomUUID) return crypto.randomUUID();
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}
