import { LogoType } from '@peertube/peertube-models'
import { CONSTRAINTS_FIELDS, MIMETYPES } from '@server/initializers/constants.js'
import { UploadFilesForCheck } from 'express'
import { isFileValid } from './misc.js'

const logoTypes = new Set<LogoType>([ 'favicon', 'header-square', 'header-wide', 'opengraph' ])

export function isConfigLogoTypeValid (value: LogoType) {
  return logoTypes.has(value)
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
