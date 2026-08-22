import { Check } from 'lucide-react';
import { useI18n } from '@/context/i18n-context';
import styles from '@/styles/auth-shell.module.css';

interface BrandPanelProps {
  headline: string;
  tagline: string;
}

/**
 * Left brand panel shared by the login and onboarding screens — hidden below
 * lg, where each screen instead renders the compact BrandMark above the form
 * card. Ported from Dokgistry's own BrandPanel (apps/web/components/BrandPanel.tsx),
 * itself ported from vault, so every product's first-run screens read as the
 * same family — same split layout, same orange glow, same feature-list shape.
 */
export function BrandPanel({ headline, tagline }: BrandPanelProps) {
  const { t } = useI18n();
  const features = [t('authBrand.feature1'), t('authBrand.feature2'), t('authBrand.feature3')];

  return (
    <section className={styles.branding}>
      <div className={`${styles.orb} ${styles.orbTopRight}`} aria-hidden="true" />
      <div className={`${styles.orb} ${styles.orbBottomLeft}`} aria-hidden="true" />
      <div className={styles.orbRing} aria-hidden="true" />
      <div className={styles.orbitGlow} aria-hidden="true" />

      <div className={styles.brandingContent}>
        <div className={styles.brandRow}>
          <span className={styles.brandLogo}>A</span>
          <span className={styles.brandName}>Accounts</span>
        </div>

        <div className={styles.headline}>
          <h1>{headline}</h1>
          <p className={styles.tagline}>{tagline}</p>
          <ul className={styles.featureList}>
            {features.map((feature) => (
              <li key={feature}>
                <span className={styles.featureCheck}>
                  <Check aria-hidden="true" />
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.footer}>
          <span>Powered by Foundathyon</span>
        </div>
      </div>
    </section>
  );
}

/** Compact brand mark shown above the form card on mobile, where BrandPanel itself is hidden. */
export function BrandMark() {
  return (
    <div className={styles.brandMarkMobile}>
      <span className={styles.brandLogo}>A</span>
      <span className={styles.brandName}>Accounts</span>
    </div>
  );
}
