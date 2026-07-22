interface TrainingPrivacyNoticeProps {
  title: string;
  description: string;
}

export function TrainingPrivacyNotice({ title, description }: TrainingPrivacyNoticeProps) {
  return (
    <section className="training-setting training-setting-wide training-privacy-note">
      <strong>{title}</strong>
      <span>{description}</span>
    </section>
  );
}
