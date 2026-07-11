import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AUTH_CHANGED_EVENT,
  type AuthLocale,
  type AuthUser,
  type HabitStatus,
  type RehabProfile,
  buildAuthStartUrl,
  clearAuthToken,
  consumeAuthTokenFromUrl,
  fetchCurrentAuthUser,
  fetchSharedAuthSession,
  getAuthApiOrigin,
  isAuthSessionMessage,
  loginPasswordAccount,
  logoutAuthSession,
  openAuthPopup,
  registerPasswordAccount,
  saveAuthProfile,
  setAuthToken,
} from '../auth/authClient';

interface AuthPanelProps {
  apiBase?: string;
  appName?: string;
  className?: string;
  locale?: AuthLocale;
  privacyHref?: string;
  onAuthChange?: (user: AuthUser | null) => void;
}

type AuthText = (typeof text)[keyof typeof text];
type AccountDialogMode = 'register' | 'login';

const chronicOptions = [
  'centralNervousSystem',
  'metabolic',
  'developmental',
  'psychotic',
  'neurotic',
] as const;

const text = {
  zhTW: {
    statusGuest: '未登入：成績只會留在這台裝置，無法跨裝置同步。',
    statusSignedIn: '已登入',
    loading: '檢查登入狀態中',
    authEntry: '註冊/登入',
    loginGoogle: '使用 Google 登入',
    logout: '登出',
    completeProfile: '完成基本資料',
    profileNeeded: '登入後請先完成匿名基本資料，之後就能跨裝置紀錄成績。',
    privacyTitle: '隱私權政策與資料蒐集說明',
    privacyIntro:
      '登入後可以跨裝置紀錄與查看訓練成績；不登入也能使用，但成績無法跨裝置同步。',
    privacyItems: [
      '登入後，訓練成績會跟著你的帳號保存。',
      '會請你填寫匿名基本資料，例如年齡、性別與國籍。',
      '若你選擇填寫，會保存醫師診斷的慢性病、抽菸與喝酒習慣。',
      '訓練成績會包含使用的工具、訓練項目、難度、時間與分數。',
      '未登入時，訓練成績只會留在目前使用的裝置。',
    ],
    privacySensitive:
      '慢性病欄位請只填寫已由醫師診斷的狀況；若沒有醫師診斷，請勿自行猜測填寫。',
    privacyPolicyLink: '開啟完整隱私權政策',
    agree: '我已閱讀並同意',
    authTitleRegister: '註冊 Rehab Trainer Hub',
    authTitleLogin: '登入 Rehab Trainer Hub',
    dividerOr: '或',
    cancel: '取消',
    accountIntroRegister: '建立帳號後可以跨裝置紀錄訓練成績。',
    accountIntroLogin: '登入後可以跨裝置紀錄與查看訓練成績。',
    accountDisplayName: '姓名',
    accountEmail: 'Email',
    accountPassword: '密碼',
    accountPasswordHelp: '密碼至少 8 個字元。',
    accountCreateSubmit: '註冊',
    accountLoginSubmit: '登入',
    switchToLogin: '已有帳號？',
    switchToLoginAction: '登入',
    switchToRegister: '還沒有帳號？',
    switchToRegisterAction: '註冊',
    accountInvalid: '請填寫姓名、有效 email 與至少 8 個字元的密碼。',
    accountFailed: '帳號登入或建立失敗，請確認資料後再試一次。',
    profileTitle: '匿名基本資料',
    profileIntro: '這些資料會和登入後的成績一起保存。請填寫已知資料，不確定時選擇不提供或不勾選。',
    ageRange: '年齡',
    gender: '性別',
    nationality: '國籍',
    selectPlaceholder: '請選擇',
    nationalityPlaceholder: '例如：台灣',
    chronicTitle: '是否有以下慢性病診斷',
    chronicReminder: '慢性病欄位請只填寫已由醫師診斷的狀況；若沒有醫師診斷，請勿自行猜測填寫。',
    centralNervousSystem: '中樞神經疾患（包含：腦傷、中風、腦腫瘤等）',
    metabolic: '新陳代謝疾患（包含：糖尿病、甲狀腺機能異常、慢性腎臟、肝臟疾病等）',
    developmental: '發展性疾患（包含：自閉症、亞斯伯格、過動症、發展遲緩等）',
    psychotic: '精神病（包含：思覺失調、妄想症、躁鬱症等）',
    neurotic: '精神官能症（包含：輕鬱症、恐慌、焦慮症等）',
    smokingTitle: '抽菸習慣',
    alcoholTitle: '喝酒習慣',
    habitNone: '無',
    habitCurrent: '有',
    habitFormer: '已經戒掉',
    frequency: '頻率',
    amount: '次數或數量',
    intervalWeek: '每週',
    intervalMonth: '每月',
    smokingPacks: '包',
    smokingCigarettes: '根',
    alcoholBottles: '瓶',
    alcoholCans: '罐',
    alcoholCups: '杯',
    saveProfile: '儲存資料',
    saving: '儲存中',
    required: '請填寫年齡、性別與國籍。',
    currentHabitNeedsAmount: '若選擇「有」抽菸或喝酒，請填寫頻率與數量。',
    loginFailed: '登入流程無法開始，請稍後再試。',
    profileFailed: '資料儲存失敗，請稍後再試。',
  },
  en: {
    statusGuest: 'Not signed in: scores stay on this device and will not sync across devices.',
    statusSignedIn: 'Signed in',
    loading: 'Checking sign-in status',
    authEntry: 'Sign up / sign in',
    loginGoogle: 'Sign in with Google',
    logout: 'Sign out',
    completeProfile: 'Complete profile',
    profileNeeded: 'After sign-in, complete the anonymous profile to sync scores across devices.',
    privacyTitle: 'Privacy Policy and Data Collection Notice',
    privacyIntro:
      'Sign in to record and view training scores across devices. You can use training without signing in, but scores will not sync across devices.',
    privacyItems: [
      'Signed-in scores are saved with your account.',
      'You will be asked for anonymous basics such as age, gender, and nationality.',
      'If you choose to provide them, physician-diagnosed chronic conditions, smoking habits, and alcohol habits are saved.',
      'Training scores include the tool, training item, difficulty, time, and score.',
      'Without sign-in, scores stay only on the device you are using.',
    ],
    privacySensitive:
      'For chronic condition fields, only select conditions diagnosed by a physician. Do not guess or self-diagnose.',
    privacyPolicyLink: 'Open full privacy policy',
    agree: 'I have read and agree',
    authTitleRegister: 'Sign up for Rehab Trainer Hub',
    authTitleLogin: 'Sign in to Rehab Trainer Hub',
    dividerOr: 'or',
    cancel: 'Cancel',
    accountIntroRegister: 'Create an account to record training scores across devices.',
    accountIntroLogin: 'Sign in to record and view training scores across devices.',
    accountDisplayName: 'Name',
    accountEmail: 'Email',
    accountPassword: 'Password',
    accountPasswordHelp: 'Use at least 8 characters.',
    accountCreateSubmit: 'Sign up',
    accountLoginSubmit: 'Sign in',
    switchToLogin: 'Already have an account?',
    switchToLoginAction: 'Sign in',
    switchToRegister: "Don't have an account?",
    switchToRegisterAction: 'Sign up',
    accountInvalid: 'Enter a name, valid email, and a password with at least 8 characters.',
    accountFailed: 'Account sign-in or creation failed. Check the details and try again.',
    profileTitle: 'Anonymous Profile',
    profileIntro: 'These fields are saved with signed-in scores. Fill in known data only.',
    ageRange: 'Age',
    gender: 'Gender',
    nationality: 'Nationality',
    selectPlaceholder: 'Select',
    nationalityPlaceholder: 'For example: Taiwan',
    chronicTitle: 'Physician-diagnosed chronic conditions',
    chronicReminder: 'Only select chronic conditions diagnosed by a physician. Do not guess or self-diagnose.',
    centralNervousSystem: 'Central nervous system conditions, including brain injury, stroke, or brain tumor',
    metabolic: 'Metabolic conditions, including diabetes, thyroid disorders, chronic kidney or liver disease',
    developmental: 'Developmental conditions, including autism, Asperger syndrome, ADHD, or developmental delay',
    psychotic: 'Psychotic disorders, including schizophrenia, delusional disorder, or bipolar disorder',
    neurotic: 'Neurotic disorders, including mild depression, panic, or anxiety disorders',
    smokingTitle: 'Smoking habit',
    alcoholTitle: 'Alcohol habit',
    habitNone: 'No',
    habitCurrent: 'Yes',
    habitFormer: 'Quit',
    frequency: 'Frequency',
    amount: 'Amount',
    intervalWeek: 'Per week',
    intervalMonth: 'Per month',
    smokingPacks: 'packs',
    smokingCigarettes: 'cigarettes',
    alcoholBottles: 'bottles',
    alcoholCans: 'cans',
    alcoholCups: 'cups',
    saveProfile: 'Save profile',
    saving: 'Saving',
    required: 'Please fill in age, gender, and nationality.',
    currentHabitNeedsAmount: 'When smoking or alcohol is set to Yes, frequency and amount are required.',
    loginFailed: 'Sign-in could not start. Please try again later.',
    profileFailed: 'Profile could not be saved. Please try again later.',
  },
} as const;

const ageRanges = ['0-17', '18-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80+'];
const genderOptions = [
  { value: 'woman', zhTW: '女性', en: 'Woman' },
  { value: 'man', zhTW: '男性', en: 'Man' },
  { value: 'nonbinary', zhTW: '非二元', en: 'Non-binary' },
  { value: 'preferNotToSay', zhTW: '不提供', en: 'Prefer not to say' },
] as const;

const defaultSmokingFrequency = {
  interval: 'week',
  amount: '',
  unit: 'cigarettes',
} as const;

const defaultAlcoholFrequency = {
  interval: 'week',
  amount: '',
  unit: 'cups',
} as const;

function createEmptyProfile(): RehabProfile {
  return {
    ageRange: '',
    gender: '',
    nationality: '',
    chronicDiagnoses: [],
    smokingStatus: 'none',
    smokingFrequency: { ...defaultSmokingFrequency },
    alcoholStatus: 'none',
    alcoholFrequency: { ...defaultAlcoholFrequency },
  };
}

function createEmptyAccountForm() {
  return {
    displayName: '',
    email: '',
    password: '',
  };
}

function toTextKey(locale: AuthLocale | undefined): keyof typeof text {
  return locale === 'en' ? 'en' : 'zhTW';
}

function normalizeProfile(profile: RehabProfile | undefined): RehabProfile {
  return {
    ...createEmptyProfile(),
    ...profile,
    chronicDiagnoses: profile?.chronicDiagnoses ?? [],
    smokingFrequency: profile?.smokingFrequency ?? createEmptyProfile().smokingFrequency,
    alcoholFrequency: profile?.alcoholFrequency ?? createEmptyProfile().alcoholFrequency,
  };
}

export function AuthPanel({
  apiBase,
  appName = 'Rehab Trainer Hub',
  className,
  locale,
  privacyHref,
  onAuthChange,
}: AuthPanelProps) {
  const labels = text[toTextKey(locale)];
  const [user, setUser] = useState<AuthUser | null>(null);

  const [error, setError] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [accountDialogMode, setAccountDialogMode] = useState<AccountDialogMode | null>(null);
  const [accountForm, setAccountForm] = useState(createEmptyAccountForm);
  const [accountError, setAccountError] = useState('');
  const [isSubmittingAccount, setIsSubmittingAccount] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<RehabProfile>(createEmptyProfile);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const authOrigin = useMemo(() => getAuthApiOrigin(apiBase), [apiBase]);
  const resolvedPrivacyHref = useMemo(() => {
    if (privacyHref) return privacyHref;
    return authOrigin ? `${authOrigin}/privacy/` : '/privacy/';
  }, [authOrigin, privacyHref]);

  const applyLoadedUser = useCallback((nextUser: AuthUser | null) => {
    setUser(nextUser);
    onAuthChange?.(nextUser);
    if (!nextUser) return;

    setPrivacyAccepted(false);
    setAccountDialogMode(null);
    setAccountForm(createEmptyAccountForm());
    setAccountError('');
    if (!nextUser.profileCompleted) {
      setProfile(normalizeProfile(nextUser.profile));
      setIsProfileOpen(true);
    }
  }, [onAuthChange]);

  const loadUser = useCallback(async (): Promise<AuthUser | null> => {
    setError('');
    try {
      let nextUser = await fetchCurrentAuthUser(apiBase);
      if (!nextUser) {
        const sharedSession = await fetchSharedAuthSession(apiBase);
        if (sharedSession) {
          setAuthToken(sharedSession.token, false);
          nextUser = sharedSession.user;
        }
      }
      applyLoadedUser(nextUser);
      return nextUser;
    } catch (loadError) {
      console.warn('Unable to load auth user.', loadError);
      applyLoadedUser(null);
      return null;
    }
  }, [apiBase, applyLoadedUser]);

  useEffect(() => {
    const consumed = consumeAuthTokenFromUrl();
    void loadUser();
    if (consumed) window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  }, [loadUser]);

  useEffect(() => {
    const handleAuthChange = () => void loadUser();
    const handleMessage = (event: MessageEvent) => {
      if (authOrigin && event.origin !== authOrigin) return;
      if (!isAuthSessionMessage(event.data)) return;
      setAuthToken(event.data.token);
      applyLoadedUser(event.data.user);
    };

    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChange);
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChange);
      window.removeEventListener('message', handleMessage);
    };
  }, [applyLoadedUser, authOrigin, loadUser]);

  const openAccountDialog = async (mode: AccountDialogMode = 'login') => {
    setError('');
    setAccountError('');
    if (user) return;
    const existingUser = await loadUser();
    if (existingUser) return;
    setPrivacyAccepted(false);
    setAccountDialogMode(mode);
  };

  const startGoogleLogin = () => {
    try {
      const authUrl = buildAuthStartUrl('google', {
        apiBase,
        locale,
        privacyAccepted: true,
        returnTo: window.location.href,
      });
      const popup = openAuthPopup(authUrl);
      if (!popup) window.location.assign(authUrl);
      closeAccountDialog();
    } catch (loginError) {
      console.warn('Unable to start OAuth login.', loginError);
      setError(labels.loginFailed);
    }
  };

  const closeAccountDialog = () => {
    setAccountDialogMode(null);
    setPrivacyAccepted(false);
    setAccountForm(createEmptyAccountForm());
    setAccountError('');
  };

  const submitAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const displayName = accountForm.displayName.trim();
    const email = accountForm.email.trim();
    const password = accountForm.password;
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!accountDialogMode) return;
    if (
      !emailIsValid
      || password.length < 8
      || (accountDialogMode === 'register' && (!displayName || !privacyAccepted))
    ) {
      setAccountError(labels.accountInvalid);
      return;
    }

    setIsSubmittingAccount(true);
    setAccountError('');
    try {
      const session = accountDialogMode === 'register'
        ? await registerPasswordAccount(apiBase, {
            displayName,
            email,
            password,
            privacyAccepted: true,
          })
        : await loginPasswordAccount(apiBase, { email, password });
      setAuthToken(session.token);
      applyLoadedUser(session.user);
    } catch (submitError) {
      console.warn('Unable to use password account.', submitError);
      setAccountError(labels.accountFailed);
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    onAuthChange?.(null);
    void logoutAuthSession(apiBase).catch((logoutError) => {
      console.warn('Unable to clear shared auth session.', logoutError);
      clearAuthToken();
    });
  };

  const updateProfile = <K extends keyof RehabProfile>(key: K, value: RehabProfile[K]) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const toggleChronicDiagnosis = (value: string) => {
    setProfile((current) => ({
      ...current,
      chronicDiagnoses: current.chronicDiagnoses.includes(value)
        ? current.chronicDiagnoses.filter((item) => item !== value)
        : [...current.chronicDiagnoses, value],
    }));
  };

  const validateProfile = () => {
    if (!profile.ageRange || !profile.gender || !profile.nationality.trim()) {
      return labels.required;
    }
    if (profile.smokingStatus === 'current' && !profile.smokingFrequency?.amount.trim()) {
      return labels.currentHabitNeedsAmount;
    }
    if (profile.alcoholStatus === 'current' && !profile.alcoholFrequency?.amount.trim()) {
      return labels.currentHabitNeedsAmount;
    }
    return '';
  };

  const submitProfile = async () => {
    const validationError = validateProfile();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSavingProfile(true);
    setError('');
    try {
      const cleanedProfile: RehabProfile = {
        ...profile,
        nationality: profile.nationality.trim(),
        smokingFrequency: profile.smokingStatus === 'current' ? profile.smokingFrequency : undefined,
        alcoholFrequency: profile.alcoholStatus === 'current' ? profile.alcoholFrequency : undefined,
      };
      const nextUser = await saveAuthProfile(apiBase, cleanedProfile);
      setUser(nextUser);
      onAuthChange?.(nextUser);
      setIsProfileOpen(false);
    } catch (saveError) {
      console.warn('Unable to save auth profile.', saveError);
      setError(labels.profileFailed);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const accountEmailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountForm.email.trim());
  const canRegisterAccount = Boolean(accountForm.displayName.trim())
    && accountEmailIsValid
    && accountForm.password.length >= 8
    && privacyAccepted;
  const canLoginAccount = accountEmailIsValid && accountForm.password.length >= 8;
  const canSubmitAccount = accountDialogMode === 'register' ? canRegisterAccount : canLoginAccount;

  return (
    <section className={`auth-panel ${className ?? ''}`} aria-label={`${appName} account`}>
      <div className="auth-panel-actions">
        {user ? (
          <>
            {!user.profileCompleted && (
              <button className="auth-button auth-button-secondary" type="button" onClick={() => setIsProfileOpen(true)}>
                {labels.completeProfile}
              </button>
            )}
            <button className="auth-button auth-button-secondary" type="button" onClick={handleLogout}>
              {labels.logout}
            </button>
          </>
        ) : (
          <button className="auth-button auth-button-primary" type="button" onClick={() => void openAccountDialog()}>
            {labels.authEntry}
          </button>
        )}
      </div>

      {error && <p className="auth-panel-error">{error}</p>}
      {user && !user.profileCompleted && <p className="auth-panel-note">{labels.profileNeeded}</p>}

      {accountDialogMode && (
        <div className="auth-dialog-backdrop">
          <div className="auth-dialog auth-account-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-account-title">
            <h2 id="auth-account-title">
              {accountDialogMode === 'register' ? labels.authTitleRegister : labels.authTitleLogin}
            </h2>
            <p>{accountDialogMode === 'register' ? labels.accountIntroRegister : labels.accountIntroLogin}</p>
            <form className="auth-account-form" onSubmit={submitAccount}>
              {accountDialogMode === 'login' && (
                <>
                  <button className="auth-provider-button" type="button" onClick={startGoogleLogin}>
                    <img
                      alt=""
                      aria-hidden="true"
                      className="auth-provider-mark"
                      src="/assets/google-logo.jpg"
                    />
                    <span>{labels.loginGoogle}</span>
                  </button>
                  <div className="auth-divider" role="separator">
                    <span>{labels.dividerOr}</span>
                  </div>
                </>
              )}
              {accountDialogMode === 'register' && (
                <label>
                  <span>{labels.accountDisplayName}</span>
                  <input
                    autoComplete="name"
                    required
                    type="text"
                    value={accountForm.displayName}
                    onChange={(event) => setAccountForm((current) => ({ ...current, displayName: event.target.value }))}
                  />
                </label>
              )}
              <label>
                <span>{labels.accountEmail}</span>
                <input
                  autoComplete="email"
                  required
                  type="email"
                  value={accountForm.email}
                  onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))}
                />
              </label>
              <label>
                <span>{labels.accountPassword}</span>
                <input
                  autoComplete={accountDialogMode === 'register' ? 'new-password' : 'current-password'}
                  minLength={8}
                  required
                  type="password"
                  value={accountForm.password}
                  onChange={(event) => setAccountForm((current) => ({ ...current, password: event.target.value }))}
                />
              </label>
              <p className="auth-panel-note">{labels.accountPasswordHelp}</p>
              {accountDialogMode === 'register' && (
                <>
                  <p>{labels.privacyIntro}</p>
                  <ul>
                    {labels.privacyItems.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                  <p className="auth-sensitive-warning">{labels.privacySensitive}</p>
                  <p>
                    <a className="auth-privacy-link" href={resolvedPrivacyHref} target="_blank" rel="noopener noreferrer">
                      {labels.privacyPolicyLink}
                    </a>
                  </p>
                  <label className="auth-checkbox-row">
                    <input
                      checked={privacyAccepted}
                      onChange={(event) => setPrivacyAccepted(event.target.checked)}
                      type="checkbox"
                    />
                    <span>{labels.agree}</span>
                  </label>
                </>
              )}
              {accountError && <p className="auth-panel-error">{accountError}</p>}
              <div className="auth-dialog-actions">
                <button className="auth-button auth-button-primary" disabled={!canSubmitAccount || isSubmittingAccount} type="submit">
                  {accountDialogMode === 'register' ? labels.accountCreateSubmit : labels.accountLoginSubmit}
                </button>
              </div>
              <p className="auth-switch-line">
                <span>{accountDialogMode === 'register' ? labels.switchToLogin : labels.switchToRegister}</span>{' '}
                <button
                  className="auth-link-button"
                  type="button"
                  onClick={() => {
                    setAccountDialogMode(accountDialogMode === 'register' ? 'login' : 'register');
                    setAccountError('');
                    setPrivacyAccepted(false);
                  }}
                >
                  {accountDialogMode === 'register' ? labels.switchToLoginAction : labels.switchToRegisterAction}
                </button>
              </p>
              <button className="auth-link-button auth-cancel-link" type="button" onClick={closeAccountDialog}>
                {labels.cancel}
              </button>
            </form>
          </div>
        </div>
      )}

      {isProfileOpen && (
        <div className="auth-dialog-backdrop">
          <div className="auth-dialog auth-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-profile-title">
            <h2 id="auth-profile-title">{labels.profileTitle}</h2>
            <p>{labels.profileIntro}</p>
            <div className="auth-profile-grid">
              <label>
                <span>{labels.ageRange}</span>
                <select value={profile.ageRange} onChange={(event) => updateProfile('ageRange', event.target.value)}>
                  <option value="">{labels.selectPlaceholder}</option>
                  {ageRanges.map((range) => <option key={range} value={range}>{range}</option>)}
                </select>
              </label>
              <label>
                <span>{labels.gender}</span>
                <select value={profile.gender} onChange={(event) => updateProfile('gender', event.target.value)}>
                  <option value="">{labels.selectPlaceholder}</option>
                  {genderOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option[toTextKey(locale)]}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>{labels.nationality}</span>
                <input
                  type="text"
                  value={profile.nationality}
                  onChange={(event) => updateProfile('nationality', event.target.value)}
                  placeholder={labels.nationalityPlaceholder}
                />
              </label>
            </div>

            <fieldset className="auth-fieldset">
              <legend>{labels.chronicTitle}</legend>
              <p className="auth-sensitive-warning">{labels.chronicReminder}</p>
              {chronicOptions.map((option) => (
                <label className="auth-checkbox-row" key={option}>
                  <input
                    checked={profile.chronicDiagnoses.includes(option)}
                    onChange={() => toggleChronicDiagnosis(option)}
                    type="checkbox"
                  />
                  <span>{labels[option]}</span>
                </label>
              ))}
            </fieldset>

            <HabitFields
              labels={labels}
              status={profile.smokingStatus}
              title={labels.smokingTitle}
              units={[
                ['cigarettes', labels.smokingCigarettes],
                ['packs', labels.smokingPacks],
              ]}
              value={profile.smokingFrequency ?? { ...defaultSmokingFrequency }}
              onStatusChange={(value) => updateProfile('smokingStatus', value)}
              onValueChange={(value) => updateProfile('smokingFrequency', value)}
            />

            <HabitFields
              labels={labels}
              status={profile.alcoholStatus}
              title={labels.alcoholTitle}
              units={[
                ['cups', labels.alcoholCups],
                ['cans', labels.alcoholCans],
                ['bottles', labels.alcoholBottles],
              ]}
              value={profile.alcoholFrequency ?? { ...defaultAlcoholFrequency }}
              onStatusChange={(value) => updateProfile('alcoholStatus', value)}
              onValueChange={(value) => updateProfile('alcoholFrequency', value)}
            />

            <div className="auth-dialog-actions">
              {user?.profileCompleted && (
                <button className="auth-button auth-button-secondary" type="button" onClick={() => setIsProfileOpen(false)}>
                  {labels.cancel}
                </button>
              )}
              <button className="auth-button auth-button-primary" disabled={isSavingProfile} type="button" onClick={submitProfile}>
                {isSavingProfile ? labels.saving : labels.saveProfile}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function HabitFields<Unit extends string>({
  labels,
  status,
  title,
  units,
  value,
  onStatusChange,
  onValueChange,
}: {
  labels: AuthText;
  status: HabitStatus;
  title: string;
  units: [Unit, string][];
  value: { interval: 'week' | 'month'; amount: string; unit: Unit };
  onStatusChange: (value: HabitStatus) => void;
  onValueChange: (value: { interval: 'week' | 'month'; amount: string; unit: Unit }) => void;
}) {
  return (
    <fieldset className="auth-fieldset auth-habit-fieldset">
      <legend>{title}</legend>
      <div className="auth-radio-row" role="radiogroup" aria-label={title}>
        {([
          ['none', labels.habitNone],
          ['current', labels.habitCurrent],
          ['former', labels.habitFormer],
        ] as [HabitStatus, string][]).map(([valueKey, label]) => (
          <label key={valueKey}>
            <input
              checked={status === valueKey}
              name={title}
              onChange={() => onStatusChange(valueKey)}
              type="radio"
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {status === 'current' && (
        <div className="auth-profile-grid auth-frequency-grid">
          <label>
            <span>{labels.frequency}</span>
            <select
              value={value.interval}
              onChange={(event) => onValueChange({ ...value, interval: event.target.value as 'week' | 'month' })}
            >
              <option value="week">{labels.intervalWeek}</option>
              <option value="month">{labels.intervalMonth}</option>
            </select>
          </label>
          <label>
            <span>{labels.amount}</span>
            <input
              min="0"
              step="0.1"
              type="number"
              value={value.amount}
              onChange={(event) => onValueChange({ ...value, amount: event.target.value })}
            />
          </label>
          <label>
            <span>{labels.amount}</span>
            <select value={value.unit} onChange={(event) => onValueChange({ ...value, unit: event.target.value as Unit })}>
              {units.map(([unitValue, unitLabel]) => <option key={unitValue} value={unitValue}>{unitLabel}</option>)}
            </select>
          </label>
        </div>
      )}
    </fieldset>
  );
}
