import { getResumableUploadChunkSize, pick } from '@peertube/peertube-core-utils'
import { HttpStatusCode } from '@peertube/peertube-models'
import { cleanUpReqFiles } from '@server/helpers/express-utils.js'
import { createLogger } from '@server/helpers/logger.js'
import { Redis } from '@server/lib/redis/index.js'
import express from 'express'
import { body, header } from 'express-validator'
import { areValidationErrors } from './shared/utils.js'

const logger = createLogger()

// Metadata fields uploadx reads to build the upload id (so the client can resume the upload) and the file name/type
const UPLOADX_METADATA_FIELDS = [
  'name',
  'title',
  'originalName',
  'filename',
  'mimeType',
  'contentType',
  'type',
  'filetype',
  'size',
  'lastModified'
]

// Uploadx saves the init request body as the upload metadata, that we trust when the upload completes
// Only keep the fields we expect, so the client cannot inject server-side fields (file paths, staging keys...) or store unrelated data
export function resumableInitMetadataFieldsFactory (fields: string[]) {
  const allowedFields = [ ...UPLOADX_METADATA_FIELDS, ...fields ]

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.body = pick(req.body ?? {}, allowedFields)

    // Uploadx only reads req.body for a JSON request, otherwise it builds the metadata from the unfiltered query string
    // Body parsers (json, urlencoded, multer) already consumed the request stream, so it's safe to change the content type
    req.headers['content-type'] = 'application/json; charset=utf-8'

    return next()
  }
}

export const resumableInitValidator = [
  body('filename')
    .exists(),

  header('x-upload-content-length')
    .isNumeric()
    .exists()
    .withMessage('Should specify the file length'),
  header('x-upload-content-type')
    .isString()
    .exists()
    .withMessage('Should specify the file mimetype'),

  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.debug('Checking resumableInitValidator parameters and headers', {
      parameters: req.body,
      headers: req.headers
    })

    if (areValidationErrors(req, res, { omitLog: true })) return cleanUpReqFiles(req)

    res.locals.uploadVideoFileResumableMetadata = {
      mimetype: req.headers['x-upload-content-type'] as string,
      size: +req.headers['x-upload-content-length'],
      originalname: req.body.filename
    }

    return next()
  }
]

// The last chunk may be sent again while its upload is being processed (the client didn't get the response in time...)
// Only one request, of any process, must process the completed upload
// The session must be deleted with Redis.Instance.deleteUploadSession() once the upload is processed
export async function checkUploadSessionCanStart (req: express.Request, res: express.Response) {
  if (await Redis.Instance.startUploadSession(req.query.upload_id)) return true

  res.setHeader('Retry-After', 300) // ask to retry after 5 min, knowing the upload_id is kept for up to 15 min after completion

  res.fail({
    status: HttpStatusCode.SERVICE_UNAVAILABLE_503,
    message: req.t('The upload is already being processed')
  })

  return false
}

// When resumable uploads are streamed to object storage, each chunk becomes a multipart part
// Object storage only rejects a too small part when the upload completes, so try to reject earlier if we detect it
export function resumableChunkSizeValidatorFactory (getMinChunkSize: () => number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const minChunkSize = getMinChunkSize()
    if (!minChunkSize) return next()

    // No body, nothing to check
    const matches = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(req.headers['content-range'] || '')
    if (!matches) return next()

    const [ start, end, total ] = matches.slice(1).map(v => parseInt(v, 10))

    // Bigger chunks for a big file, so the upload doesn't exceed the max number of multipart parts
    const expectedChunkSize = getResumableUploadChunkSize({ minChunkSize, fileSize: total })

    const isLastChunk = end + 1 >= total
    if (isLastChunk || end - start + 1 >= expectedChunkSize) return next()

    return res.fail({
      status: HttpStatusCode.BAD_REQUEST_400,
      message: `Chunk size should be at least ${expectedChunkSize} bytes (except for the last chunk)`
    })
  }
}
