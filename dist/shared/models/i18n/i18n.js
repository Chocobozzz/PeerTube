"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCALE_FILES = ['player', 'server'];
exports.I18N_LOCALES = {
    'en-US': 'English',
    'fr-FR': 'Français',
    'eu-ES': 'Euskara',
    'ca-ES': 'Català',
    'cs-CZ': 'Čeština',
    'eo': 'Esperanto',
    'de-DE': 'Deutsch',
    'es-ES': 'Español',
    'oc': 'Occitan',
    'zh-Hant-TW': '繁體中文（台灣）',
    'pt-BR': 'Português (Brasil)',
    'sv-SE': 'svenska',
    'zh-Hans-CN': '简体中文（中国）'
};
const I18N_LOCALE_ALIAS = {
    'en': 'en-US',
    'fr': 'fr-FR',
    'eu': 'eu-ES',
    'ca': 'ca-ES',
    'cs': 'cs-CZ',
    'de': 'de-DE',
    'es': 'es-ES',
    'pt': 'pt-BR',
    'sv': 'sv-SE'
};
exports.POSSIBLE_LOCALES = Object.keys(exports.I18N_LOCALES)
    .concat(Object.keys(I18N_LOCALE_ALIAS));
function getDefaultLocale() {
    return 'en-US';
}
exports.getDefaultLocale = getDefaultLocale;
function isDefaultLocale(locale) {
    return getCompleteLocale(locale) === getCompleteLocale(getDefaultLocale());
}
exports.isDefaultLocale = isDefaultLocale;
function peertubeTranslate(str, translations) {
    return translations && translations[str] ? translations[str] : str;
}
exports.peertubeTranslate = peertubeTranslate;
const possiblePaths = exports.POSSIBLE_LOCALES.map(l => '/' + l);
function is18nPath(path) {
    return possiblePaths.indexOf(path) !== -1;
}
exports.is18nPath = is18nPath;
function is18nLocale(locale) {
    return exports.POSSIBLE_LOCALES.indexOf(locale) !== -1;
}
exports.is18nLocale = is18nLocale;
function getCompleteLocale(locale) {
    if (!locale)
        return locale;
    if (I18N_LOCALE_ALIAS[locale])
        return I18N_LOCALE_ALIAS[locale];
    return locale;
}
exports.getCompleteLocale = getCompleteLocale;
function getShortLocale(locale) {
    if (locale.indexOf('-') === -1)
        return locale;
    return locale.split('-')[0];
}
exports.getShortLocale = getShortLocale;
function buildFileLocale(locale) {
    const completeLocale = getCompleteLocale(locale);
    return completeLocale.replace(/-/g, '_');
}
exports.buildFileLocale = buildFileLocale;
//# sourceMappingURL=i18n.js.map