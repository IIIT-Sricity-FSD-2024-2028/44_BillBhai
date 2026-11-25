import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import usePageSetup from '../../shared/hooks/usePageSetup.js';
import { CSS, FONTS } from '../../shared/lib/pageAssets.js';
import { buildUsernameSeed } from '../../shared/lib/dashboard/credentials.js';
import {
  clearCompaniesError,
  registerCompanyThunk,
  selectCompaniesState,
} from './companiesSlice.js';
import AmbientGlow from '../auth/components/AmbientGlow.jsx';
import RegisterCard from './components/register/RegisterCard.jsx';
import RegisterField from './components/register/RegisterField.jsx';
import BusinessTypeSelect from './components/register/BusinessTypeSelect.jsx';
import PasswordStrength from './components/register/PasswordStrength.jsx';
import TermsCheckbox from './components/register/TermsCheckbox.jsx';
import RegisterButton from './components/register/RegisterButton.jsx';
import { EMPTY_GROUP } from './components/register/groupUtils.js';

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;
const PHONE_PATTERN = /^[6-9]\d{9}$/;
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,40}$/;
const PLANS = ['starter', 'pro', 'enterprise'];

const FIELDS = [
  'businessName',
  'ownerName',
  'email',
  'phone',
  'gstin',
  'businessType',
  'address',
  'username',
  'password',
  'confirmPassword',
];
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

const digits = (value) => String(value || '').replace(/\D/g, '');

/**
 * Business sign-up. Dispatches `registerCompanyThunk` to `companiesSlice`;
 * Redux updates only after the backend confirms registration.
 */
export default function RegisterBusinessPage() {
  usePageSetup({
    title: 'BillBhai — Register Your Business',
    styles: [CSS.register],
    fonts: FONTS.auth,
  });

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedPlan = PLANS.includes(params.get('plan')) ? params.get('plan') : 'starter';
  const { saving: isLoading, error: serverError } = useSelector(selectCompaniesState);

  const [values, setValues] = useState(initialValues);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [groups, setGroups] = useState(initialGroups);
  const [showing, setShowing] = useState({ password: false, confirmPassword: false });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const mounted = useRef(true);
  const redirectTimer = useRef(null);
  useEffect(() => {
    mounted.current = true;
    dispatch(clearCompaniesError());
    return () => {
      mounted.current = false;
      clearTimeout(redirectTimer.current);
    };
  }, [dispatch]);

  function updateGroup(field, patch) {
    setGroups((prev) => ({ ...prev, [field]: { ...prev[field], ...patch } }));
  }

  function handleChange(field, value) {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'ownerName' && !usernameTouched) next.username = buildUsernameSeed(value, prev.email);
      return next;
    });
    if (field === 'username') setUsernameTouched(true);
    if (field === 'confirmPassword') {
      if (value && value !== values.password) {
        updateGroup(field, { error: true, errText: 'Passwords do not match', errDisplay: 'block' });
      } else {
        updateGroup(field, { error: false, errDisplay: 'none' });
      }
    }
  }

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
    setValidationError('');
    dispatch(clearCompaniesError());

    const next = Object.fromEntries(FIELDS.map((f) => [f, { ...groups[f], error: false, shake: false }]));
    let hasError = false;
    const problems = [];
    const fail = (field, message) => {
      next[field] = { ...next[field], error: true, shake: true };
      if (message) next[field] = { ...next[field], errText: message, errDisplay: 'block' };
      hasError = true;
    };

    REQUIRED.forEach((field) => {
      if (!values[field].trim()) fail(field, 'Required');
    });
    if (values.businessName.trim() && values.businessName.trim().length < 2) fail('businessName', 'At least 2 characters');
    if (values.email.trim() && !EMAIL_PATTERN.test(values.email.trim())) fail('email', 'Please enter a valid email');
    if (values.phone.trim() && !PHONE_PATTERN.test(digits(values.phone))) {
      fail('phone', 'Enter a valid 10-digit Indian mobile number');
    }
    const gst = values.gstin.trim().toUpperCase();
    if (gst && !GSTIN_PATTERN.test(gst)) {
      fail('gstin');
      problems.push('GSTIN must be 15 characters, like 07AABCF1234K1Z5 (or leave it empty).');
    }
    if (values.address.trim() && values.address.trim().length < 8) fail('address', 'Enter the full shop address');
    if (values.username.trim() && !USERNAME_PATTERN.test(values.username.trim())) {
      fail('username', '3-40 letters, digits, dot, dash or underscore');
    }
    const pw = values.password;
    if (pw && (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw))) {
      fail('password', 'At least 8 characters with a letter and a digit');
    }
    if (pw && values.confirmPassword && pw !== values.confirmPassword) fail('confirmPassword', 'Passwords do not match');

    setGroups(next);
    if (!agreeTerms) problems.push('Please accept the Terms & Conditions.');
    if (problems.length) {
      setValidationError(problems.join(' '));
      hasError = true;
    }
    if (hasError) return;

    const email = values.email.trim().toLowerCase();
    const phone = digits(values.phone).slice(-10);
    const owner = values.ownerName.trim();

    try {
      await dispatch(
        registerCompanyThunk({
          plan: requestedPlan,
          company: {
            name: values.businessName.trim(),
            owner,
            adminName: owner,
            type: toTitleCase(values.businessType),
            email,
            phone,
            gstNo: gst,
            address: values.address.trim(),
          },
          admin: {
            name: owner,
            email,
            mobileNo: phone,
            username: values.username.trim(),
            password: pw,
          },
        }),
      ).unwrap();
      if (!mounted.current) return;
      setIsSuccess(true);
      redirectTimer.current = setTimeout(() => navigate('/choose-plan'), 700);
    } catch {
      // Server error is held in Redux (`state.companies.error`)
    }
  }

  const toggle = (field) => () => setShowing((prev) => ({ ...prev, [field]: !prev[field] }));
  const formError = validationError || serverError || '';

  return (
    <>
      <AmbientGlow />
      <RegisterCard>
        <form id="registerForm" className="register-form" autoComplete="off" onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <RegisterField {...fieldProps('businessName')} placeholder="Business Name" icon="business" />
            <RegisterField {...fieldProps('ownerName')} placeholder="Owner Full Name" icon="user" />
          </div>

          <div className="form-row">
            <RegisterField {...fieldProps('email')} type="email" placeholder="Email Address" icon="mail" />
            <RegisterField
              {...fieldProps('phone')}
              type="tel"
              placeholder="Mobile Number"
              icon="phone"
              inputProps={{ maxLength: 10, inputMode: 'numeric' }}
            />
          </div>

          <div className="form-row">
            <RegisterField
              {...fieldProps('gstin')}
              placeholder="GSTIN"
              label="GSTIN"
              icon="briefcase"
              optional
              inputProps={{ maxLength: 15, style: { textTransform: 'uppercase' } }}
            />
            <BusinessTypeSelect {...fieldProps('businessType')} />
          </div>

          <RegisterField {...fieldProps('address')} placeholder="Shop Address" icon="business" inputProps={{ maxLength: 250 }} />

          <div className="form-divider">
            <span>Your sign-in</span>
          </div>

          <RegisterField
            {...fieldProps('username')}
            placeholder="Username"
            icon="user"
            inputProps={{ maxLength: 40, autoComplete: 'username' }}
          />

          <RegisterField
            {...fieldProps('password')}
            type="password"
            placeholder="Password (min 8 chars)"
            label="Create Password"
            icon="lock"
            inputProps={{ minLength: 8, autoComplete: 'new-password' }}
            showing={showing.password}
            onToggle={toggle('password')}
          />
          <PasswordStrength password={values.password} />

          <RegisterField
            {...fieldProps('confirmPassword')}
            type="password"
            placeholder="Confirm Password"
            icon="checkCircle"
            inputProps={{ autoComplete: 'new-password' }}
            showing={showing.confirmPassword}
            onToggle={toggle('confirmPassword')}
          />

          <TermsCheckbox checked={agreeTerms} onChange={setAgreeTerms} />

          <p className="form-error" id="formError" role="alert">
            {formError}
          </p>

          <RegisterButton isLoading={isLoading} isSuccess={isSuccess} disabled={isLoading || isSuccess} />
        </form>
      </RegisterCard>
    </>
  );
}
