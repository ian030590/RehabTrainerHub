import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AUTH_CHANGED_EVENT,
  type AuthLocale,
  type AuthProvider,
  type AuthUser,
  type HabitStatus,
  type RehabProfile,
  buildAuthStartUrl,
  clearAuthToken,
  consumeAuthTokenFromUrl,
  fetchCurrentAuthUser,
  getAuthApiOrigin,
  isAuthSessionMessage,
  openAuthPopup,
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

const chronicOptions = [
  'centralNervousSystem',
  'metabolic',
  'developmental',
  'psychotic',
  'neurotic',
] as const;

const text = {
  zhTW: {
    statusGuest: '未登入：紀錄會儲存在這台裝置的 IndexedDB。',
    statusSignedIn: '已登入',
    loading: '檢查登入狀態中',
    loginGoogle: '使用 Google 登入',
    loginFacebook: '使用 Facebook 登入',
    logout: '登出',
    completeProfile: '完成基本資料',
    profileNeeded: '登入後請先完成匿名基本資料，之後的使用紀錄會儲存在 D1 database。',
    privacyTitle: '隱私權政策與資料蒐集說明',
    privacyIntro:
      '登入代表你同意 RehabTrainerHub 使用 Google 或 Facebook 提供的帳號識別資訊建立登入狀態，並蒐集匿名基本資料與訓練紀錄，用於復健工具使用分析與服務改善。',
    privacyItems: [
      '匿名基本資料包含年齡、性別、國籍等。',
      '慢性病診斷、抽菸與喝酒習慣會用於使用紀錄分組分析。',
      '訓練紀錄會包含使用的工具、難度、時間、分數與互動結果。',
      '未登入使用時，紀錄只會儲存在這台裝置的 IndexedDB。',
    ],
    privacySensitive:
      '慢性病欄位請只填寫已由醫師診斷的狀況；若沒有醫師診斷，請勿自行猜測填寫。',
    privacyPolicyLink: '開啟完整隱私權政策',
    agree: '我已閱讀並同意',
    continue: '繼續登入',
    cancel: '取消',
    profileTitle: '匿名基本資料',
    profileIntro: '這些資料會與登入後的訓練紀錄一起儲存在 D1 database。請填寫已知資料，不確定時選擇不提供或不勾選。',
    ageRange: '年齡',
    gender: '性別',
    nationality: '國籍',
    selectPlaceholder: '請選擇',
    nationalityPlaceholder: '例如：台灣',
    chronicTitle: '是否有以下慢性病診斷',
    chronicReminder: '提醒：若沒有醫師診斷，請勿自行猜測填寫。',
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
    statusGuest: 'Not signed in: records are saved to IndexedDB on this device.',
    statusSignedIn: 'Signed in',
    loading: 'Checking sign-in status',
    loginGoogle: 'Sign in with Google',
    loginFacebook: 'Sign in with Facebook',
    logout: 'Sign out',
    completeProfile: 'Complete profile',
    profileNeeded: 'After sign-in, complete the anonymous profile. Future records will be saved to D1.',
    privacyTitle: 'Privacy Policy and Data Collection Notice',
    privacyIntro:
      'By signing in, you agree that RehabTrainerHub may use account identifiers from Google or Facebook to create a session, and collect anonymous profile data and training records for usage analysis and service improvement.',
    privacyItems: [
      'Anonymous profile data includes age, gender, nationality, and similar basics.',
      'Chronic diagnosis, smoking, and alcohol habits are used for grouped record analysis.',
      'Training records include tool, difficulty, time, score, and interaction results.',
      'When you continue without sign-in, records remain in IndexedDB on this device.',
    ],
    privacySensitive:
      'For chronic condition fields, only select conditions diagnosed by a physician. Do not guess or self-diagnose.',
    privacyPolicyLink: 'Open full privacy policy',
    agree: 'I have read and agree',
    continue: 'Continue sign-in',
    cancel: 'Cancel',
    profileTitle: 'Anonymous Profile',
    profileIntro: 'These fields are stored in D1 with signed-in training records. Fill in known data only.',
    ageRange: 'Age',
    gender: 'Gender',
    nationality: 'Nationality',
    selectPlaceholder: 'Select',
    nationalityPlaceholder: 'For example: Taiwan',
    chronicTitle: 'Physician-diagnosed chronic conditions',
    chronicReminder: 'Reminder: do not guess or self-diagnose without a physician diagnosis.',
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
  appName = 'RehabTrainerHub',
  className,
  locale,
  privacyHref,
  onAuthChange,
}: AuthPanelProps) {
  const labels = text[toTextKey(locale)];
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [privacyProvider, setPrivacyProvider] = useState<AuthProvider | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<RehabProfile>(createEmptyProfile);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const authOrigin = useMemo(() => getAuthApiOrigin(apiBase), [apiBase]);
  const resolvedPrivacyHref = useMemo(() => {
    if (privacyHref) return privacyHref;
    return authOrigin ? `${authOrigin}/privacy/` : '/privacy/';
  }, [authOrigin, privacyHref]);

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const nextUser = await fetchCurrentAuthUser(apiBase);
      setUser(nextUser);
      onAuthChange?.(nextUser);
      if (nextUser && !nextUser.profileCompleted) {
        setProfile(normalizeProfile(nextUser.profile));
        setIsProfileOpen(true);
      }
    } catch (loadError) {
      console.warn('Unable to load auth user.', loadError);
      setUser(null);
      onAuthChange?.(null);
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, onAuthChange]);

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
      setUser(event.data.user);
      onAuthChange?.(event.data.user);
      if (!event.data.user.profileCompleted) {
        setProfile(normalizeProfile(event.data.user.profile));
        setIsProfileOpen(true);
      }
    };

    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChange);
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChange);
      window.removeEventListener('message', handleMessage);
    };
  }, [authOrigin, loadUser, onAuthChange]);

  const requestLogin = (provider: AuthProvider) => {
    setError('');
    setPrivacyAccepted(false);
    setPrivacyProvider(provider);
  };

  const continueLogin = () => {
    if (!privacyProvider || !privacyAccepted) return;

    try {
      const authUrl = buildAuthStartUrl(privacyProvider, {
        apiBase,
        locale,
        privacyAccepted: true,
        returnTo: window.location.href,
      });
      const popup = openAuthPopup(authUrl);
      if (!popup) window.location.assign(authUrl);
      setPrivacyProvider(null);
    } catch (loginError) {
      console.warn('Unable to start OAuth login.', loginError);
      setError(labels.loginFailed);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    setUser(null);
    onAuthChange?.(null);
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

  return (
    <section className={`auth-panel ${className ?? ''}`} aria-label={`${appName} account`}>
      <div className="auth-panel-status" role="status" aria-live="polite">
        {isLoading ? labels.loading : user ? `${labels.statusSignedIn}: ${user.displayName}` : labels.statusGuest}
      </div>

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
          <>
            <button className="auth-button auth-button-primary" type="button" onClick={() => requestLogin('google')}>
              {labels.loginGoogle}
            </button>
            <button className="auth-button auth-button-secondary" type="button" onClick={() => requestLogin('facebook')}>
              {labels.loginFacebook}
            </button>
          </>
        )}
      </div>

      {error && <p className="auth-panel-error">{error}</p>}
      {user && !user.profileCompleted && <p className="auth-panel-note">{labels.profileNeeded}</p>}

      {privacyProvider && (
        <div className="auth-dialog-backdrop">
          <div className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-privacy-title">
            <h2 id="auth-privacy-title">{labels.privacyTitle}</h2>
            <p>{labels.privacyIntro}</p>
            <ul>
              {labels.privacyItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p className="auth-panel-warning">{labels.privacySensitive}</p>
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
            <div className="auth-dialog-actions">
              <button className="auth-button auth-button-secondary" type="button" onClick={() => setPrivacyProvider(null)}>
                {labels.cancel}
              </button>
              <button
                className="auth-button auth-button-primary"
                disabled={!privacyAccepted}
                type="button"
                onClick={continueLogin}
              >
                {labels.continue}
              </button>
            </div>
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
              <p className="auth-panel-warning">{labels.chronicReminder}</p>
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
