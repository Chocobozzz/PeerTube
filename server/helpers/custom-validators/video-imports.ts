import 'express-validator'
import 'multer'
import * as validator from 'validator'
import { CONSTRAINTS_FIELDS, VIDEO_IMPORT_STATES } from '../../initializers'
import { exists } from './misc'

function isVideoImportTargetUrlValid (url: string) {
  const isURLOptions = {
    require_host: true,
    require_tld: true,
    require_protocol: true,
    require_valid_protocol: true,
    protocols: [ 'http', 'https' ]
  }

  return exists(url) &&
    validator.isURL('' + url, isURLOptions) &&
    validator.isLength('' + url, CONSTRAINTS_FIELDS.VIDEO_IMPORTS.URL)
}

function isVideoImportStateValid (value: any) {
  return exists(value) && VIDEO_IMPORT_STATES[ value ] !== undefined
}

// ---------------------------------------------------------------------------

export {
  isVideoImportStateValid,
  isVideoImportTargetUrlValid
}
