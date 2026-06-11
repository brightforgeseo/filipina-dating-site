import React from 'react';
import { getClientLang, t, type Dict, type Lang } from './index';

// Islands render on the server first (where localStorage doesn't exist), so
// start in English and switch to the saved language after hydration.
export function useLang(): { lang: Lang; d: Dict } {
  const [lang, setLang] = React.useState<Lang>('en');
  React.useEffect(() => {
    setLang(getClientLang());
  }, []);
  return { lang, d: t(lang) };
}
