import { getCompleteLocale, is18nLocale } from '@peertube/peertube-core-utils'
import { INSTANCE_TRANSLATABLE_FIELDS, InstanceTranslation, LogoType } from '@peertube/peertube-models'
import { CONSTRAINTS_FIELDS, MIMETYPES } from '@server/initializers/constants.js'
import { UploadFilesForCheck } from 'express'
import { isFileValid } from './misc.js'

const logoTypes = new Set<LogoType>([ 'favicon', 'header-square', 'header-wide', 'opengraph' ])

export function isConfigLogoTypeValid (value: LogoType) {
  return logoTypes.has(value)
}

export function areInstanceTranslationsValid (translations: InstanceTranslation[]) {
  if (!Array.isArray(translations)) return false
  if (!translations.every(t => isInstanceTranslationValid(t))) return false

  const languages = new Set(translations.map(t => getCompleteLocale(t.language)))

  return languages.size === translations.length
}

export function isInstanceTranslationValid (translation: InstanceTranslation) {
  if (!translation || typeof translation !== 'object') return false
  if (typeof translation.language !== 'string' || !is18nLocale(translation.language)) return false

  return INSTANCE_TRANSLATABLE_FIELDS.every(field => {
    const value = translation[field]

    return value === undefined || value === null || typeof value === 'string'
  })
}

const imageMimeTypesRegex = Object.keys(MIMETYPES.LOGO_IMAGE.MIMETYPE_EXT)
  .map(mimeType => `(${mimeType.replace('+', '\\+')})`)
  .join('|')

export function isLogoImageFile (files: UploadFilesForCheck, fieldname: string) {
  return isFileValid({
    files,
    mimeTypeRegex: imageMimeTypesRegex,
    field: fieldname,
    maxSize: CONSTRAINTS_FIELDS.LOGO.IMAGE.FILE_SIZE.max
  })
}
