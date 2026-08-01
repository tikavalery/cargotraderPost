import { useLanguage } from '../../i18n/LanguageContext';

/** Shared EN / FR language toggle — switches the whole app locale. */
export default function LangToggle({ className = '' }) {
  const { lang, setLang } = useLanguage();

  return (
    <div className={`lang-toggle${className ? ` ${className}` : ''}`} role="group" aria-label="Language">
      <button
        type="button"
        className={`lang-btn${lang === 'en' ? ' active' : ''}`}
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
      >
        EN
      </button>
      <button
        type="button"
        className={`lang-btn${lang === 'fr' ? ' active' : ''}`}
        onClick={() => setLang('fr')}
        aria-pressed={lang === 'fr'}
      >
        FR
      </button>
    </div>
  );
}
