import { useEffect, useId, useRef, useState } from 'react';
import Recaptcha from './Recaptcha.jsx';
import { budgets, referrals, limits, validateFields, requestId } from '../lib/contact.js';

const initial = { firstName: '', lastName: '', email: '', phone: '', country: '', company: '', website: '', industry: '', budget: 'Not Sure', referral: 'Google Search', message: '', websiteConfirm: '' };
export default function ContactForm({ quote = false }) {
  const [values, setValues] = useState(initial), [errors, setErrors] = useState({}), [token, setToken] = useState('');
  const [pending, setPending] = useState(false), [status, setStatus] = useState({ type: '', message: '' }), [locked, setLocked] = useState(false);
  const busy = useRef(false), captcha = useRef(null), id = useRef(requestId()), abort = useRef(null), alive = useRef(true);
  const prefix = useId(), statusRef = useRef(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; abort.current?.abort(); }; }, []);
  function change(event) {
    const { name, value } = event.target;
    setValues(old => ({ ...old, [name]: value }));
    setErrors(old => ({ ...old, [name]: undefined }));
  }
  async function submit(event) {
    event.preventDefault();
    if (busy.current || locked) return;
    const nextErrors = validateFields(values);
    if (!token) nextErrors.recaptchaToken = 'Please complete the verification.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setStatus({ type: 'error', message: 'Please check the highlighted fields.' });
      const field = Object.keys(nextErrors)[0];
      document.getElementById(`${prefix}-${field}`)?.focus();
      return;
    }
    busy.current = true; setPending(true); setStatus({ type: '', message: '' });
    abort.current = new AbortController();
    const timer = setTimeout(() => abort.current.abort(), 45000);
    try {
      const response = await fetch('/api/contact.php', {
        method: 'POST', credentials: 'same-origin', signal: abort.current.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...values, formType: quote ? 'quote' : 'contact', recaptchaToken: token, requestId: id.current }),
      });
      let result;
      try { result = await response.json(); } catch { throw Error('The server returned an unexpected response. Please contact info@devoskisystems.com if the problem continues.'); }
      if (!alive.current) return;
      if (!response.ok || result.ok !== true) {
        setErrors(result.errors || {});
        if (['delivery_unknown', 'submission_processing'].includes(result.code)) setLocked(true);
        const wait = response.status === 429 ? ` Please wait ${result.retryAfter || 60} seconds before trying again.` : '';
        setStatus({ type: 'error', message: (result.message || 'Your enquiry could not be sent.') + wait });
      } else {
        setValues(initial); setLocked(true);
        setStatus({ type: 'success', message: result.message || 'Thank you. Your enquiry has been sent to our team.' });
      }
    } catch (error) {
      if (alive.current) setStatus({ type: 'error', message: error.name === 'AbortError' ? 'The request timed out. Delivery is not confirmed. Retry with this form to check the same enquiry, or contact us directly.' : 'We could not confirm delivery. Please check your connection and retry with this form, or contact info@devoskisystems.com.' });
    } finally {
      clearTimeout(timer); busy.current = false;
      if (alive.current) { setPending(false); setToken(''); captcha.current?.reset(); requestAnimationFrame(() => statusRef.current?.focus()); }
    }
  }
  function field(name, label, type = 'text', required = false, autoComplete) {
    return <label htmlFor={`${prefix}-${name}`} key={name}>{label}{required ? ' *' : ''}<input id={`${prefix}-${name}`} name={name} type={type} value={values[name]} onChange={change} required={required} maxLength={limits[name]} autoComplete={autoComplete} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${prefix}-${name}-error` : undefined} />{errors[name] && <span className="field-error" id={`${prefix}-${name}-error`}>{errors[name]}</span>}</label>;
  }
  return <form className="enquiry-form" onSubmit={submit} noValidate aria-busy={pending}>
    <fieldset disabled={pending || locked}><legend className="sr-only">{quote ? 'Request a project quote' : 'Contact Devoski Systems'}</legend><div className="form-grid">
      {field('firstName', 'First name', 'text', true, 'given-name')}{field('lastName', 'Last name', 'text', true, 'family-name')}{field('email', 'Email', 'email', true, 'email')}{field('phone', 'Phone number', 'tel', false, 'tel')}
      {quote && <>{field('country', 'Country', 'text', false, 'country-name')}{field('company', 'Company', 'text', false, 'organization')}{field('website', 'Website', 'url')}{field('industry', 'Industry')}<label>Budget<select name="budget" value={values.budget} onChange={change}>{budgets.map(value => <option key={value}>{value}</option>)}</select>{errors.budget && <span className="field-error">{errors.budget}</span>}</label><label>How did you hear about us?<select name="referral" value={values.referral} onChange={change}>{referrals.map(value => <option key={value}>{value}</option>)}</select>{errors.referral && <span className="field-error">{errors.referral}</span>}</label></>}
      <label className="full" htmlFor={`${prefix}-message`}>{quote ? 'Project details' : 'Your message'} *<textarea id={`${prefix}-message`} name="message" value={values.message} onChange={change} minLength={10} maxLength={limits.message} rows="5" required aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? `${prefix}-message-error` : undefined} />{errors.message && <span className="field-error" id={`${prefix}-message-error`}>{errors.message}</span>}</label>
    </div><div className="honeypot" aria-hidden="true"><label>Leave this field empty<input name="websiteConfirm" tabIndex={-1} autoComplete="off" value={values.websiteConfirm} onChange={change} /></label></div></fieldset>
    {!locked && <><Recaptcha ref={captcha} onToken={value => { setToken(value); if (value) setErrors(old => ({ ...old, recaptchaToken: undefined })); }} onError={message => setErrors(old => ({ ...old, recaptchaToken: message }))} />{errors.recaptchaToken && <p className="field-error">{errors.recaptchaToken}</p>}<p className="form-note">Your details will be used to respond to this enquiry. <a href="/privacy-policy/">Privacy policy</a></p></>}
    <button className="button" type="submit" disabled={pending || locked || !token}>{pending ? 'Sending…' : locked ? status.type === 'success' ? 'Enquiry sent' : 'Please contact us directly' : 'Send enquiry'} <span aria-hidden="true">↗</span></button>
    <p className={`form-status ${status.type}`} role="status" aria-live="polite" ref={statusRef} tabIndex={-1}>{status.message}</p>
    {locked && status.type === 'success' && <button type="button" className="verification-retry" onClick={() => { id.current = requestId(); setLocked(false); setStatus({ type: '', message: '' }); }}>Start a new enquiry</button>}
    {status.type === 'error' && <a className="contact-fallback" href="mailto:info@devoskisystems.com">Email info@devoskisystems.com ↗</a>}
  </form>;
}
