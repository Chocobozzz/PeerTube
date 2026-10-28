import { getCompleteLocale } from '@peertube/peertube-core-utils'
import { InstanceTranslatableField, InstanceTranslation } from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'

// Get instance information in the requested language, falling back to the default instance information
export function getInstanceInformation (language: string): Record<InstanceTranslatableField, string> {
  const translation = findInstanceTranslation(language)

  const translate = (field: InstanceTranslatableField, defaultValue: string) => translation?.[field] || defaultValue

  return {
    shortDescription: translate('shortDescription', CONFIG.INSTANCE.SHORT_DESCRIPTION),
    description: translate('description', CONFIG.INSTANCE.DESCRIPTION),
    terms: translate('terms', CONFIG.INSTANCE.TERMS),
    codeOfConduct: translate('codeOfConduct', CONFIG.INSTANCE.CODE_OF_CONDUCT),
    moderationInformation: translate('moderationInformation', CONFIG.INSTANCE.MODERATION_INFORMATION),
    administrator: translate('administrator', CONFIG.INSTANCE.ADMINISTRATOR),
    creationReason: translate('creationReason', CONFIG.INSTANCE.CREATION_REASON),
    maintenanceLifetime: translate('maintenanceLifetime', CONFIG.INSTANCE.MAINTENANCE_LIFETIME),
    businessModel: translate('businessModel', CONFIG.INSTANCE.BUSINESS_MODEL),
    hardwareInformation: translate('hardwareInformation', CONFIG.INSTANCE.HARDWARE_INFORMATION),
    supportText: translate('supportText', CONFIG.INSTANCE.SUPPORT.TEXT)
  }
}

// Exact locale first, then another locale of the same language (`pt-PT` translation for a `pt-BR` visitor)
export function findInstanceTranslation (language: string): InstanceTranslation {
  const translations = CONFIG.INSTANCE.TRANSLATIONS
  if (!language || translations.length === 0) return undefined

  const completeLocale = normalizeLocale(language)

  const exact = translations.find(t => normalizeLocale(t.language) === completeLocale)
  if (exact) return exact

  const languageWithScript = getLanguageWithScript(completeLocale)

  return translations.find(t => getLanguageWithScript(normalizeLocale(t.language)) === languageWithScript)
}

// ---------------------------------------------------------------------------

function normalizeLocale (locale: string) {
  return getCompleteLocale(locale).toLowerCase()
}

// Keep the script subtag, so a `zh-Hant-TW` visitor doesn't get a `zh-Hans-CN` translation
function getLanguageWithScript (locale: string) {
  const [ language, script ] = locale.split('-')

  return script?.length === 4
    ? `${language}-${script}`
    : language
}
