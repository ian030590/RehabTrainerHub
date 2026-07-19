export { AuthPanel } from './components/AuthPanel';
export type { AuthLocale, AuthProvider, AuthUser, RehabProfile } from './auth/authClient';
export { AppLoading } from './components/AppLoading';
export type { AppLoadingProps } from './components/AppLoading';
export { ConfigDialog } from './components/ConfigDialog';
export type { ConfigDialogProps } from './components/ConfigDialog';
export { EditableSettingRow } from './components/EditableSettingRow';
export type { EditableSettingRowProps } from './components/EditableSettingRow';
export { ExternalLinkCard } from './components/ExternalLinkCard';
export type { ExternalLinkCardProps } from './components/ExternalLinkCard';
export { NumberPresetSelector } from './components/NumberPresetSelector';
export type { NumberPresetSelectorProps } from './components/NumberPresetSelector';
export { RehabFooter } from './components/RehabFooter';
export type { RehabFooterProps } from './components/RehabFooter';
export { RelatedLinksGridPage } from './components/RelatedLinksGridPage';
export type { RelatedLinkItem, RelatedLinksGridPageProps } from './components/RelatedLinksGridPage';
export { ResultSummary } from './components/ResultSummary';
export type { ResultSummaryItem, ResultSummaryProps } from './components/ResultSummary';
export { SelectionCard } from './components/SelectionCard';
export type { SelectionCardProps } from './components/SelectionCard';
export { SettingsTabs } from './components/SettingsTabs';
export type { SettingsTabItem, SettingsTabsProps } from './components/SettingsTabs';
export { StartTrainingButton } from './components/StartTrainingButton';
export type { StartTrainingButtonProps } from './components/StartTrainingButton';
export { TrainingConfigActions, TrainingConfigPanel } from './components/TrainingConfigPanel';
export type { TrainingConfigActionsProps, TrainingConfigPanelProps } from './components/TrainingConfigPanel';
export { TrainingConfigSummary } from './components/TrainingConfigSummary';
export type { TrainingConfigSummaryItem, TrainingConfigSummaryProps } from './components/TrainingConfigSummary';
export { TrainingRulesPanel } from './components/TrainingRulesPanel';
export type { TrainingRuleSection, TrainingRulesPanelProps } from './components/TrainingRulesPanel';
export { TrainingResultActions } from './components/TrainingResultActions';
export type { TrainingResultActionsProps } from './components/TrainingResultActions';
export { TrainerAppLayout } from './components/TrainerAppLayout';
export type { TrainerAppLayoutProps } from './components/TrainerAppLayout';
export { TrainingModuleSelectionPage } from './components/TrainingModuleSelectionPage';
export type {
  TrainingModuleSelectionItem,
  TrainingModuleSelectionPageProps,
} from './components/TrainingModuleSelectionPage';
export { TrainerNavbar } from './components/TrainerNavbar';
export type {
  TrainerNavbarItem,
  TrainerNavbarLinkClassName,
  TrainerNavbarProps,
} from './components/TrainerNavbar';
export { TrainingLoginReminder } from './components/TrainingLoginReminder';
export { UserSelector } from './components/UserSelector';
export type { UserSelectorProps } from './components/UserSelector';
export { detectDisplayDeviceKind, is60HzRefreshFamily, measureDisplayRefreshRate } from './displayTiming';
export type { DisplayDeviceKind, DisplayRefreshInfo, DisplayRefreshMeasureOptions } from './displayTiming';
export { createCsvContent, ensureCsvUtf8Bom, toCsvCell } from './csv';
export type { CsvCellValue, CsvRow } from './csv';
export { downloadCsvFile, downloadFile } from './downloadFile';
export { enterFullscreenFromUserGesture, exitFullscreenIfActive, waitForFullscreenLayout } from './fullscreen';
export { createUseActiveUser } from './hooks/useActiveUser';
export { useFullscreenTrainingRoot } from './hooks/useFullscreenTrainingRoot';
export { useRoutedTrainingModule } from './hooks/useRoutedTrainingModule';
export type { UseRoutedTrainingModuleArgs } from './hooks/useRoutedTrainingModule';
export { useTrainingAbort } from './hooks/useTrainingAbort';
export type { UseTrainingAbortArgs } from './hooks/useTrainingAbort';
export { applyDisplaySettings } from './settings/displaySettings';
export type { DisplaySettings } from './settings/displaySettings';
export { defaultSiteUrls, normalizeSiteUrl } from './siteUrls';
export type { SiteUrlKey, SiteUrls } from './siteUrls';
export { createUserStore } from './storage/userStore';
export type { UserStore } from './storage/userStore';
export {
  applyThemeTokens,
  cssColors,
  pixiColors,
  radii,
  shadows,
  spacing,
  transitions,
  typography,
} from './trainerTheme';
export {
  drawUfovCanvasStage,
  ensureUfovCanvasStage,
  prepareUfovNoiseMask,
  renderUfovCanvasStage,
} from './ufovCanvas';
export type { UfovCanvasPhase, UfovCanvasSlot, UfovCanvasStageOptions, UfovCanvasTarget } from './ufovCanvas';
export {
  estimateUfovThresholdMs,
  getFastestCorrectStimulusDurationMs,
  getUfovDirectionAccuracy,
  shouldStopUfovAdaptiveRun,
  UFOV_ADAPTIVE_STOP,
} from './ufovResults';
export type { UfovAdaptiveRunState, UfovDirectionAccuracy } from './ufovResults';
