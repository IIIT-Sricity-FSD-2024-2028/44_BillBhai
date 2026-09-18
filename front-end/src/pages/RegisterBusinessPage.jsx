import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePageSetup from '../hooks/usePageSetup.js';
import { CSS, FONTS } from '../lib/pageAssets.js';
import AmbientGlow from '../components/login/AmbientGlow.jsx';
import RegisterCard from '../components/register/RegisterCard.jsx';
import RegisterField from '../components/register/RegisterField.jsx';
import BusinessTypeSelect from '../components/register/BusinessTypeSelect.jsx';
import PasswordStrength from '../components/register/PasswordStrength.jsx';
import TermsCheckbox from '../components/register/TermsCheckbox.jsx';
import RegisterButton from '../components/register/RegisterButton.jsx';
import { EMPTY_GROUP } from '../components/register/groupUtils.js';

// React port of register-business.html + scripts/register.js.

const API_BASE_URL = 'http://localhost:4000/api';
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;
const PHONE_PATTERN = /^[6-9]\d{9}$/;

// Fields in DOM order; `required` ones are checked for emptiness on submit.
const FIELDS = ['businessName', 'ownerName', 'email', 'phone', 'gstin', 'businessType', 'password', 'confirmPassword'];
const REQUIRED = FIELDS.filter((f) => f !== 'gstin');

const initialValues = Object.fromEntries(FIELDS.map((f) => [f, '']));
const initialGroups = Object.fromEntries(FIELDS.map((f) => [f, EMPTY_GROUP]));

function toTitleCase(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidEmailAddress(value) {
  return EMAIL_PATTERN.test(String(value || '').trim());
}

function isValidPhoneNumber(value) {
  return PHONE_PATTERN.test(normalizePhoneDigits(value));
}

function deriveAdminUsername(ownerName, email) {
  const emailSeed = String(email || '').trim().split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '');
  if (emailSeed) return emailSeed;
  const ownerSeed = String(ownerName || '').trim().toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '');
  return ownerSeed || `owner${Date.now().toString().slice(-4)}`;
}

async function createBusinessAccount(payload) {
  const companyPayload = {
    name: payload.businessName,
    owner: payload.ownerName,
    adminName: payload.ownerName,
    type: toTitleCase(payload.businessType),
    email: payload.email,
    phone: payload.phone,
    gstNo: payload.gstin || undefined,
    address: 'India',
    plan: 'starter',
    productsPlan: 'Starter Plan (Free)',
    subscriptionStatus: 'Active',
    monthlyPrice: 0,
    renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    tenureMonths: 0,
    storesCount: 1,
  };

  const companyResponse = await fetch(`${API_BASE_URL}/companies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-role': 'superuser' },
    body: JSON.stringify(companyPayload),
  });
  if (!companyResponse.ok) {
    const bodyText = await companyResponse.text().catch(() => '');
    throw new Error(`Company creation failed (${companyResponse.status}): ${bodyText || 'Unknown error'}`);
  }
  const companyRecord = await companyResponse.json();

  const username = deriveAdminUsername(payload.ownerName, payload.email);
  const userPayload = {
    companyId: String((companyRecord && companyRecord.id) || '').trim(),
    name: payload.ownerName,
    role: 'admin',
    email: payload.email,
    mobileNo: payload.phone,
    username,
    password: payload.password,
  };

  const userResponse = await fetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-role': 'superuser' },
    body: JSON.stringify(userPayload),
  });
  if (!userResponse.ok) {
    const bodyText = await userResponse.text().catch(() => '');
    throw new Error(`Admin user creation failed (${userResponse.status}): ${bodyText || 'Unknown error'}`);
  }
  const userRecord = await userResponse.json();

  return { company: companyRecord, user: userRecord, username, password: payload.password };
}

export default function RegisterBusinessPage() {
  usePageSetup({ title: 'BillBhai — Register Your Business', styles: [CSS.register], fonts: FONTS.auth });

  const navigate = useNavigate();
  const [values, setValues] = useState(initialValues);
  const [groups, setGroups] = useState(initialGroups);
  const [showing, setShowing] = useState({ password: false, confirmPassword: false });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [disabled, setDisabled] = useState(false);

  const mounted = useRef(true);
  const redirectTimer = useRef(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(redirectTimer.current);
    };
  }, []);

  function updateGroup(field, patch) {
    setGroups((prev) => ({ ...prev, [field]: { ...prev[field], ...patch } }));
  }

  function handleChange(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }));
    // Real-time password match (runs on input of the confirm field only).
    if (field === 'confirmPassword') {
      if (value && value !== values.password) {
        updateGroup(field, { error: true, errText: 'Passwords do not match', errDisplay: 'block' });
      } else {
        updateGroup(field, { error: false, errDisplay: 'none' });
      }
    }
  }

  // Focusing a field clears its error state and hides its message.
  function handleFocus(field) {
    updateGroup(field, { error: false, shake: false, errDisplay: field === 'gstin' ? '' : 'none' });
  }

  function fieldProps(field) {
    return {
      id: field,
      value: values[field],
      status: groups[field],
      onChange: (value) => handleChange(field, value),
      onFocus: () => handleFocus(field),
      onShakeEnd: () => updateGroup(field, { shake: false }),
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    const next = Object.fromEntries(FIELDS.map((f) => [f, { ...groups[f], error: false, shake: false }]));
    let hasError = false;
    const fail = (field, message) => {
      next[field] = { ...next[field], error: true, shake: true };
      if (message) next[field] = { ...next[field], errText: message, errDisplay: 'block' };
      hasError = true;
    };

    REQUIRED.forEach((field) => {
      if (!values[field].trim()) fail(field);
    });

    if (values.email.trim() && !isValidEmailAddress(values.email)) {
      fail('email', 'Please enter a valid email');
    }

    if (values.phone.trim() && !isValidPhoneNumber(values.phone)) {
      fail('phone', 'Enter a valid 10-digit Indian mobile number');
    }

    const pw = values.password;
    const cpw = values.confirmPassword;
    if (pw && cpw && pw !== cpw) {
      fail('confirmPassword', 'Passwords do not match');
    }

    if (pw && pw.length < 6) {
      fail('password', 'Password must be at least 6 characters');
    }

    setGroups(next);

    if (!agreeTerms) {
      setFormError('Please accept the Terms & Conditions');
      hasError = true;
    }

    if (hasError) return;

    const submitPayload = {
      businessName: values.businessName.trim(),
      ownerName: values.ownerName.trim(),
      email: values.email.trim().toLowerCase(),
      phone: normalizePhoneDigits(values.phone),
      gstin: values.gstin.trim(),
      businessType: values.businessType.trim(),
      password: values.password,
    };

    setIsLoading(true);
    setDisabled(true);
    try {
      const created = await createBusinessAccount(submitPayload);
      sessionStorage.setItem('bb_recent_business_signup', JSON.stringify({
        createdAt: new Date().toISOString(),
        businessId: created.company && created.company.id,
        businessName: created.company && created.company.name,
        ownerName: submitPayload.ownerName,
        username: created.username,
        password: created.password,
        email: submitPayload.email,
        phone: submitPayload.phone,
      }));
      if (!mounted.current) return;
      setIsLoading(false);
      setIsSuccess(true);
      redirectTimer.current = setTimeout(() => {
        navigate('/choose-plan');
      }, 800);
    } catch (error) {
      console.error('Business registration failed:', error);
      if (!mounted.current) return;
      setFormError(error && error.message ? error.message : 'Could not create business account right now.');
      setIsLoading(false);
      setDisabled(false);
    }
  }

  const toggle = (field) => () => setShowing((prev) => ({ ...prev, [field]: !prev[field] }));

  return (
    <>
      <AmbientGlow />
      <RegisterCard>
        <form id="registerForm" className="register-form" autoComplete="off" onSubmit={handleSubmit}>
          <div className="form-row">
            <RegisterField {...fieldProps('businessName')} placeholder="Business Name" icon="business" />
            <RegisterField {...fieldProps('ownerName')} placeholder="Owner Full Name" icon="user" />
          </div>

          <div className="form-row">
            <RegisterField {...fieldProps('email')} type="email" placeholder="Email Address" icon="mail" />
            <RegisterField
              {...fieldProps('phone')}
              type="tel"
              placeholder="Phone Number"
              icon="phone"
              inputProps={{ maxLength: 10, inputMode: 'numeric' }}
            />
          </div>

          <div className="form-row">
            <RegisterField {...fieldProps('gstin')} placeholder="GSTIN (Optional)" label="GSTIN" icon="briefcase" optional />
            <BusinessTypeSelect {...fieldProps('businessType')} />
          </div>

          <div className="form-divider"><span>Security</span></div>

          <RegisterField
            {...fieldProps('password')}
            type="password"
            placeholder="Create Password"
            icon="lock"
            inputProps={{ minLength: 6 }}
            showing={showing.password}
            onToggle={toggle('password')}
          />
          <PasswordStrength password={values.password} />

          <RegisterField
            {...fieldProps('confirmPassword')}
            type="password"
            placeholder="Confirm Password"
            icon="checkCircle"
            showing={showing.confirmPassword}
            onToggle={toggle('confirmPassword')}
          />

          <TermsCheckbox checked={agreeTerms} onChange={setAgreeTerms} />

          <p className="form-error" id="formError">{formError}</p>

          <RegisterButton isLoading={isLoading} isSuccess={isSuccess} disabled={disabled} />
        </form>
      </RegisterCard>
    </>
  );
}
