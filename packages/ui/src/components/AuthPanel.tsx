import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  authChangedEvent,
  type AuthLocale,
  type AuthUser,
  type HabitStatus,
  type RehabProfile,
  BuildAuthStartUrl,
  ClearAuthToken,
  FetchCurrentAuthUser,
  FetchSharedAuthSession,
  GetAuthApiOrigin,
  IsAuthSessionMessage,
  LoginPasswordAccount,
  LogoutAuthSession,
  OpenAuthPopup,
  RegisterPasswordAccount,
  SaveAuthProfile,
  SetAuthToken,
} from '../auth/authClient';
import { TurnstileWidget } from './TurnstileWidget';

interface AuthPanelProps {
  apiBase?: string;
  appName?: string;
  className?: string;
  locale?: AuthLocale;
  privacyHref?: string;
  onAuthChange?: (user: AuthUser | null) => void;
  turnstileSiteKey?: string;
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
    statusGuest: '需登入並完成問卷後才能開始訓練。',
    statusSignedIn: '已登入',
    loading: '檢查登入狀態中',
    authEntry: '註冊/登入',
    loginGoogle: '使用 Google 登入',
    logout: '登出',
    completeProfile: '完成問卷',
    profileNeeded: '登入後請先完成基本資料與醫療史問卷，完成前無法開始訓練。',
    privacyTitle: '隱私權政策與資料蒐集說明',
    privacyIntro:
      '註冊/登入並完成問卷後才能使用訓練工具。送出前請確認你了解以下資料蒐集方式。',
    privacyItems: [
      '登入帳號資料只用於建立登入狀態與辨識同一位使用者。',
      '會請你填寫基本資料問卷：年齡、性別與國籍。',
      '會請你填寫醫療史問卷：醫師診斷的慢性病類別、抽菸與喝酒習慣。',
      '訓練紀錄會包含使用的工具、訓練項目、難度、時間與分數。',
      '沒有登入或未完成必要問卷時，無法開始訓練。',
    ],
    privacySensitive:
      '慢性病欄位請只填寫已由醫師診斷的狀況；若沒有醫師診斷，請勿自行猜測填寫。',
    privacyPolicyLink: '開啟完整隱私權政策',
    agree: '我已閱讀並同意',
    authTitleRegister: '註冊 Rehab Trainer Hub',
    authTitleLogin: '登入 Rehab Trainer Hub',
    dividerOr: '或',
    cancel: '取消',
    accountIntroRegister: '建立帳號後可以跨裝置保存訓練紀錄。',
    accountIntroLogin: '登入後可以跨裝置保存與查看訓練紀錄。',
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
    accountCreated: '帳號建立完成，請使用同一組 email 與密碼登入。',
    verificationRequired: '請先完成人機驗證。',
    privacyRequired: '請先閱讀並同意隱私權政策與資料蒐集說明。',
    profileTitle: '基本資料與醫療史問卷',
    profileIntro: '這些資料會和登入後的訓練紀錄一起保存，用於分組分析與改善服務。完成前無法開始訓練。',
    basicQuestionnaire: '基本資料問卷',
    medicalQuestionnaire: '醫療史問卷',
    medicalIntro: '請只填寫已知且正確的資料；慢性病只勾選醫師已診斷的狀況。本平台不會依填寫內容提供診斷或個別醫療建議。',
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
    unit: '單位',
    intervalWeek: '每週',
    intervalMonth: '每月',
    smokingPacks: '包',
    smokingCigarettes: '根',
    alcoholBottles: '瓶',
    alcoholCans: '罐',
    alcoholCups: '杯',
    saveProfile: '儲存資料',
    saving: '儲存中',
    required: '請填寫基本資料問卷中的年齡、性別與國籍。',
    currentHabitNeedsAmount: '若選擇「有」抽菸或喝酒，請填寫頻率與數量。',
    loginFailed: '登入流程無法開始，請稍後再試。',
    profileFailed: '資料儲存失敗，請稍後再試。',
  },
  en: {
    statusGuest: 'Sign in and complete the questionnaires before training.',
    statusSignedIn: 'Signed in',
    loading: 'Checking sign-in status',
    authEntry: 'Sign up / sign in',
    loginGoogle: 'Sign in with Google',
    logout: 'Sign out',
    completeProfile: 'Complete questionnaires',
    profileNeeded: 'After sign-in, complete the basic profile and medical history questionnaires before training.',
    privacyTitle: 'Privacy Policy and Data Collection Notice',
    privacyIntro:
      'Training requires sign-up/sign-in and questionnaire completion. Confirm you understand this data collection before submitting.',
    privacyItems: [
      'Account data is used only to establish sign-in and identify the same user.',
      'You will complete a basic profile questionnaire: age, gender, and nationality.',
      'You will complete a medical history questionnaire: physician-diagnosed chronic condition categories, smoking habits, and alcohol habits.',
      'Training records include the tool, training item, difficulty, time, and score.',
      'Without sign-in or required questionnaire completion, training cannot start.',
    ],
    privacySensitive:
      'For chronic condition fields, only select conditions diagnosed by a physician. Do not guess or self-diagnose.',
    privacyPolicyLink: 'Open full privacy policy',
    agree: 'I have read and agree',
    authTitleRegister: 'Sign up for Rehab Trainer Hub',
    authTitleLogin: 'Sign in to Rehab Trainer Hub',
    dividerOr: 'or',
    cancel: 'Cancel',
    accountIntroRegister: 'Create an account to save training records across devices.',
    accountIntroLogin: 'Sign in to save and view training records across devices.',
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
    accountCreated: 'Account created. Sign in with the same email and password.',
    verificationRequired: 'Complete the human verification first.',
    privacyRequired: 'Read and agree to the privacy policy and data collection notice first.',
    profileTitle: 'Basic Profile and Medical History Questionnaires',
    profileIntro: 'These fields are saved with signed-in training records for grouped analysis and service improvement. Training is blocked until they are complete.',
    basicQuestionnaire: 'Basic Profile Questionnaire',
    medicalQuestionnaire: 'Medical History Questionnaire',
    medicalIntro: 'Provide only known and accurate information. Select chronic conditions only when diagnosed by a physician. This platform will not provide diagnosis or individual medical advice based on these answers.',
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
    unit: 'Unit',
    intervalWeek: 'Per week',
    intervalMonth: 'Per month',
    smokingPacks: 'packs',
    smokingCigarettes: 'cigarettes',
    alcoholBottles: 'bottles',
    alcoholCans: 'cans',
    alcoholCups: 'cups',
    saveProfile: 'Save profile',
    saving: 'Saving',
    required: 'Please complete age, gender, and nationality in the basic profile questionnaire.',
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

function CreateEmptyProfile(): RehabProfile {
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

function CreateEmptyAccountForm() {
  return {
    displayName: '',
    email: '',
    password: '',
  };
}

function ToTextKey(locale: AuthLocale | undefined): keyof typeof text {
  return locale === 'en' ? 'en' : 'zhTW';
}

function NormalizeProfile(profile: RehabProfile | undefined): RehabProfile {
  return {
    ...CreateEmptyProfile(),
    ...profile,
    chronicDiagnoses: profile?.chronicDiagnoses ?? [],
    smokingFrequency: profile?.smokingFrequency ?? CreateEmptyProfile().smokingFrequency,
    alcoholFrequency: profile?.alcoholFrequency ?? CreateEmptyProfile().alcoholFrequency,
  };
}

export function AuthPanel({
  apiBase,
  appName = 'Rehab Trainer Hub',
  className,
  locale,
  privacyHref,
  onAuthChange,
  turnstileSiteKey,
}: AuthPanelProps) {
  const labels = text[ToTextKey(locale)];
  const [user, setUser] = useState<AuthUser | null>(null);

  const [error, setError] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [accountDialogMode, setAccountDialogMode] = useState<AccountDialogMode | null>(null);
  const [accountForm, setAccountForm] = useState(CreateEmptyAccountForm);
  const [accountError, setAccountError] = useState('');
  const [isSubmittingAccount, setIsSubmittingAccount] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<RehabProfile>(CreateEmptyProfile);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const authOrigin = useMemo(() => GetAuthApiOrigin(apiBase), [apiBase]);
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
    setAccountForm(CreateEmptyAccountForm());
    setAccountError('');
    if (!nextUser.profileCompleted) {
      setProfile(NormalizeProfile(nextUser.profile));
      setIsProfileOpen(true);
    }
  }, [onAuthChange]);

  const loadUser = useCallback(async (): Promise<AuthUser | null> => {
    setError('');
    try {
      let nextUser = await FetchCurrentAuthUser(apiBase);
      if (!nextUser) {
        const sharedSession = await FetchSharedAuthSession(apiBase);
        if (sharedSession) {
          SetAuthToken(sharedSession.token, false);
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
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    const handleAuthChange = () => void loadUser();
    const handleMessage = (event: MessageEvent) => {
      if (authOrigin && event.origin !== authOrigin) return;
      if (!IsAuthSessionMessage(event.data)) return;
      SetAuthToken(event.data.token);
      applyLoadedUser(event.data.user);
    };

    window.addEventListener(authChangedEvent, handleAuthChange);
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener(authChangedEvent, handleAuthChange);
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
    if (!privacyAccepted) {
      setAccountError(labels.privacyRequired);
      return;
    }
    if (turnstileSiteKey && !turnstileToken) {
      setAccountError(labels.verificationRequired);
      return;
    }

    try {
      const authUrl = BuildAuthStartUrl('google', {
        apiBase,
        locale,
        privacyAccepted,
        returnTo: window.location.href,
        turnstileToken: turnstileToken ?? undefined,
      });
      const popup = OpenAuthPopup(authUrl);
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
    setAccountForm(CreateEmptyAccountForm());
    setAccountError('');
    setTurnstileToken(null);
    setTurnstileResetKey((current) => current + 1);
  };

  const submitAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const displayName = accountForm.displayName.trim();
    const email = accountForm.email.trim();
    const password = accountForm.password;
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!accountDialogMode) return;
    if (turnstileSiteKey && !turnstileToken) {
      setAccountError(labels.verificationRequired);
      return;
    }
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
      if (accountDialogMode === 'register') {
        await RegisterPasswordAccount(apiBase, {
          displayName,
          email,
          password,
          privacyAccepted: true,
          turnstileToken: turnstileToken ?? undefined,
        });
        setTurnstileToken(null);
        setTurnstileResetKey((current) => current + 1);
        setAccountDialogMode('login');
        setAccountForm({ displayName: '', email, password: '' });
        setAccountError(labels.accountCreated);
        return;
      }
      const session = await LoginPasswordAccount(apiBase, {
        email,
        password,
        turnstileToken: turnstileToken ?? undefined,
      });
      SetAuthToken(session.token);
      applyLoadedUser(session.user);
    } catch (submitError) {
      console.warn('Unable to use password account.', submitError);
      setAccountError(labels.accountFailed);
      setTurnstileToken(null);
      setTurnstileResetKey((current) => current + 1);
    } finally {
      setIsSubmittingAccount(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    onAuthChange?.(null);
    void LogoutAuthSession(apiBase).catch((logoutError) => {
      console.warn('Unable to clear shared auth session.', logoutError);
      ClearAuthToken();
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
      const nextUser = await SaveAuthProfile(apiBase, cleanedProfile);
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
  const hasVerification = !turnstileSiteKey || Boolean(turnstileToken);
  const privacyNotice = (
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
  );

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
                  {privacyNotice}
                  <TurnstileWidget
                    action="auth"
                    language={locale}
                    onTokenChange={setTurnstileToken}
                    resetKey={turnstileResetKey}
                    siteKey={turnstileSiteKey}
                  />
                  <button className="auth-provider-button" disabled={!privacyAccepted || !hasVerification} type="button" onClick={startGoogleLogin}>
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
                privacyNotice
              )}
              {accountDialogMode === 'register' && (
                <TurnstileWidget
                  action="auth"
                  language={locale}
                  onTokenChange={setTurnstileToken}
                  resetKey={turnstileResetKey}
                  siteKey={turnstileSiteKey}
                />
              )}
              {accountError && <p className="auth-panel-error">{accountError}</p>}
              <div className="auth-dialog-actions">
                <button className="auth-button auth-button-primary" disabled={!canSubmitAccount || !hasVerification || isSubmittingAccount} type="submit">
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
                    setTurnstileToken(null);
                    setTurnstileResetKey((current) => current + 1);
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
            <h3 className="auth-section-heading">{labels.basicQuestionnaire}</h3>
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
                    <option key={option.value} value={option.value}>{option[ToTextKey(locale)]}</option>
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

            <h3 className="auth-section-heading">{labels.medicalQuestionnaire}</h3>
            <p className="auth-sensitive-warning">{labels.medicalIntro}</p>
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
            <span>{labels.unit}</span>
            <select value={value.unit} onChange={(event) => onValueChange({ ...value, unit: event.target.value as Unit })}>
              {units.map(([unitValue, unitLabel]) => <option key={unitValue} value={unitValue}>{unitLabel}</option>)}
            </select>
          </label>
        </div>
      )}
    </fieldset>
  );
}
