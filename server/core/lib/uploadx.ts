import { install as logtapeInstall } from '@logtape/adaptor-winston'
import { ServerFilterHookName } from '@peertube/peertube-models'
import { getLowercaseExtension } from '@peertube/peertube-node-utils'
import { buildWinstonLogger } from '@server/helpers/logger.js'
import { buildVideoUploadFileExtension, getResumableUploadPath } from '@server/helpers/upload.js'
import { generateRandomString } from '@server/helpers/utils.js'
import { CONFIG } from '@server/initializers/config.js'
import { WEBSERVER } from '@server/initializers/constants.js'
import {
  getResumableUploadMinChunkSize,
  isUserImportUploadObjectStorageEnabled,
  isVideoUploadObjectStorageEnabled
} from '@server/lib/object-storage/config.js'
import {
  buildStagingKey,
  downloadStagingObject,
  fromStagingFullKey,
  generateStagingObjectPresignedUrl,
  removeStagingObject,
  StagingSubPrefix,
  storeStagingObject
} from '@server/lib/object-storage/staging.js'
import { PluginManager } from '@server/lib/plugins/plugin-manager.js'
import { authenticate } from '@server/middlewares/auth.js'
import {
  resumableChunkSizeValidatorFactory,
  resumableInitMetadataFieldsFactory,
  resumableInitValidator
} from '@server/middlewares/validators/resumable-upload.js'
import { DiskStorage, FileQuery, Uploadx, File as UploadxCoreFile, Metadata as UploadXMetadata } from '@uploadx/core'
import express, { NextFunction, Request, RequestHandler, Response, ResumableUploadImageFile, VideoUploadMetadata } from 'express'
import { remove } from 'fs-extra/esm'
import { basename, extname, join } from 'path'

const logger = buildWinstonLogger({ labelSuffix: 'uploadx' })
logtapeInstall(logger)

// Uploadx handler that knows where its uploads are stored (local disk or object storage staging)
export class PeerTubeUploadx extends Uploadx<UploadxCoreFile> {
  constructor (private readonly peertubeOptions: {
    isObjectStorageEnabled: () => boolean
    stagingSubPrefix: StagingSubPrefix

    // Extension of the local file (on disk or downloaded from staging), FFmpeg picks some demuxers from it
    buildFileExtension: (options: { filename: string, mimetype: string }) => string
  }) {
    super({
      // Lazily set by initStorage()
      storage: undefined,

      userIdentifier: (_, res: express.Response) => {
        if (!res.locals.oauth) return undefined

        return res.locals.oauth.token.user.id + ''
      }
    })
  }

  async initStorage () {
    this.storage = await buildUploadxStorage({
      objectStorage: this.isObjectStorageEnabled(),
      stagingSubPrefix: this.peertubeOptions.stagingSubPrefix,
      buildFileExtension: this.peertubeOptions.buildFileExtension
    })
  }

  isObjectStorageEnabled () {
    return this.peertubeOptions.isObjectStorageEnabled()
  }

  getStagingSubPrefix () {
    return this.peertubeOptions.stagingSubPrefix
  }

  getMinChunkSize () {
    return getResumableUploadMinChunkSize({ objectStorage: this.isObjectStorageEnabled() })
  }

  // Build the file passed to the controller, from the completed upload
  async buildFile<T extends UploadXMetadata> (reqBody: T) {
    const filename = reqBody.metadata.filename
    const originalname = reqBody.originalName

    const objectStorage = this.isObjectStorageEnabled()

    const stagingKey = objectStorage
      ? fromStagingFullKey(reqBody.name) // Full staging object key, file is not available locally
      : undefined

    const extension = this.peertubeOptions.buildFileExtension({ filename, mimetype: reqBody.contentType })

    const path = objectStorage
      ? join(getResumableUploadPath(), await generateRandomString(16) + extension)
      : getResumableUploadPath(reqBody.name)

    return {
      // oxlint-disable-next-line @typescript-eslint/no-misused-spread
      ...reqBody,

      path,
      stagingKey,

      filename,
      originalname
    }
  }
}

export const videoUploadx = new PeerTubeUploadx({
  isObjectStorageEnabled: isVideoUploadObjectStorageEnabled,
  stagingSubPrefix: 'RESUMABLE_UPLOADS',
  buildFileExtension: buildVideoUploadFileExtension
})

export const userImportsUploadx = new PeerTubeUploadx({
  isObjectStorageEnabled: isUserImportUploadObjectStorageEnabled,
  stagingSubPrefix: 'USER_IMPORTS',

  // The init validator only accepts .zip files
  buildFileExtension: ({ filename }) => extname(filename)
})

// Must be called before handling resumable upload requests
export async function initUploadxStorages () {
  await videoUploadx.initStorage()
  await userImportsUploadx.initStorage()
}

type CleanableUploadXFile = FileQuery & Pick<VideoUploadMetadata, 'path' | 'stagingKey'> & { metadata?: UploadXMetadata }

export async function uploadXCleanup (file: CleanableUploadXFile, uploadxInstance: PeerTubeUploadx) {
  await uploadxInstance.storage.delete(file)

  if (file.stagingKey) {
    if (file.path) await remove(file.path)

    // Uploadx only aborts incomplete multipart uploads
    // Remove the completed staging object ourselves
    await removeStagingObject(file.stagingKey)
  }

  await removeStagedImages(file.metadata)
}

export function safeUploadXCleanup (file: CleanableUploadXFile, uploadxInstance: PeerTubeUploadx) {
  uploadXCleanup(file, uploadxInstance)
    .catch(err => logger.error('Cannot delete the file %s', file.name, { err }))
}

// FFmpeg reads a staged video upload using a presigned URL
// Only built after checkUploadSessionCanStart(), so a duplicate last chunk request doesn't sign a URL for nothing
export async function buildVideoUploadXFile<T extends UploadXMetadata> (reqBody: T) {
  const file = await videoUploadx.buildFile(reqBody)

  return {
    ...file,

    ffmpegInput: file.stagingKey
      ? await generateStagingObjectPresignedUrl(file.stagingKey)
      : file.path
  }
}

// The uploaded video file: the staging object (read by FFmpeg using the presigned URL `ffmpegInput`) or the local file
export function getUploadXFileInput (
  file: VideoUploadMetadata & { size: number }
): { path: string } | { url: string, size: number, extname: string, stagingKey: string } {
  if (!file.stagingKey) return { path: file.path }

  return { url: file.ffmpegInput, size: file.size, extname: getLowercaseExtension(file.path), stagingKey: file.stagingKey }
}

// Plugins of this hook expect the uploaded file on the local disk: download a staged upload to its local `path`
// TODO: Remove in PeerTube V10, where plugins will have to fetch the remote file if needed
export async function makeUploadXFileAvailableForHookIfNeeded (file: VideoUploadMetadata & { size: number },
  hookName: ServerFilterHookName)
{
  if (!file.stagingKey || !PluginManager.Instance.hasHook(hookName)) return

  logger.warn(
    'Downloading a staged upload of %d bytes in the upload request, because plugins %s use the %s hook. It may time out for big files.',
    file.size,
    PluginManager.Instance.getPluginNamesOfHook(hookName).join(', '),
    hookName
  )

  try {
    await downloadStagingObject({ key: file.stagingKey, destination: file.path })
  } catch (err) {
    await remove(file.path)

    throw err
  }

  file.ffmpegInput = file.path
}

// ---------------------------------------------------------------------------

// Images sent with the init request of a video upload (thumbnail, preview) are written on the disk of the process receiving it
// With staging, another process may receive the last chunk: store them in staging too
export async function stageResumableUploadImagesIfNeeded (files: Express.Multer.File[]): Promise<ResumableUploadImageFile[]> {
  if (!videoUploadx.isObjectStorageEnabled()) return files

  const result: ResumableUploadImageFile[] = []

  for (const file of files) {
    const stagingKey = buildStagingKey(videoUploadx.getStagingSubPrefix(), 'images/' + basename(file.path))

    await storeStagingObject({ key: stagingKey, inputPath: file.path, contentType: file.mimetype })
    await remove(file.path)

    // The local path is only valid on the host of this process: makeResumableUploadImagesAvailable() sets a new one
    result.push({ ...file, path: undefined, stagingKey })
  }

  return result
}

// Download staged images in the tmp directory of this process, before using them
export async function makeResumableUploadImagesAvailable (metadata: UploadXMetadata) {
  for (const image of getStagedImages(metadata)) {
    const destination = join(CONFIG.STORAGE.TMP_DIR, await generateRandomString(16) + extname(image.originalname))

    try {
      await downloadStagingObject({ key: image.stagingKey, destination })
    } catch (err) {
      await remove(destination)

      throw err
    }

    image.path = destination
  }
}

// ---------------------------------------------------------------------------

export function setupUploadResumableRoutes (options: {
  router: express.Router
  routePath: string

  uploadxInstance?: PeerTubeUploadx // default videoUploadx

  // Init request body fields to keep in the upload metadata, in addition to uploadx ones
  initMetadataFields: string[]

  uploadInitBeforeMiddlewares?: RequestHandler[]
  uploadInitAfterMiddlewares?: RequestHandler[]

  uploadedMiddlewares?: ((req: Request<any>, res: Response, next: NextFunction) => void)[]
  uploadedController: (req: Request<any>, res: Response, next: NextFunction) => void

  uploadDeleteMiddlewares?: RequestHandler[]
}) {
  const {
    router,
    routePath,
    uploadxInstance = videoUploadx,
    initMetadataFields,
    uploadedMiddlewares = [],
    uploadedController,
    uploadInitBeforeMiddlewares = [],
    uploadInitAfterMiddlewares = [],
    uploadDeleteMiddlewares = []
  } = options

  router.post(
    routePath,
    authenticate,
    ...uploadInitBeforeMiddlewares,
    resumableInitMetadataFieldsFactory(initMetadataFields),
    resumableInitValidator,
    ...uploadInitAfterMiddlewares,
    // Prevent next() call, explicitly tell to uploadx it's the end
    (req, res) => uploadxInstance.upload(req, res)
  )

  router.delete(
    routePath,
    authenticate,
    ...uploadDeleteMiddlewares,
    // Prevent next() call, explicitly tell to uploadx it's the end
    (req, res) => uploadxInstance.upload(req, res)
  )

  router.put(
    routePath,
    authenticate,
    resumableChunkSizeValidatorFactory(() => uploadxInstance.getMinChunkSize()),
    uploadxInstance.upload, // uploadx doesn't next() before the file upload completes
    ...uploadedMiddlewares,
    uploadedController
  )
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function getStagedImages (metadata: UploadXMetadata): (ResumableUploadImageFile & { stagingKey: string })[] {
  if (!metadata) return []

  return [ metadata.previewfile, metadata.thumbnailfile ]
    .filter(files => Array.isArray(files))
    .flat()
    .filter((image: ResumableUploadImageFile) => !!image?.stagingKey)
}

async function removeStagedImages (metadata: UploadXMetadata) {
  for (const image of getStagedImages(metadata)) {
    if (image.path) await remove(image.path)

    await removeStagingObject(image.stagingKey)
  }
}

async function buildUploadxStorage (options: {
  objectStorage: boolean
  stagingSubPrefix: StagingSubPrefix
  buildFileExtension: (options: { filename: string, mimetype: string }) => string
}) {
  const storageOptions = {
    expiration: { maxAge: undefined, rolling: true },

    // Could be big with a big thumbnail
    maxMetadataSize: '10MB',

    // Used to build the upload URL sent to the client
    // Don't rely on request headers: the request may come from a reverse proxy/load balancer not in trust_proxy
    baseUrl: WEBSERVER.URL
  }

  if (options.objectStorage) {
    const { buildResumableUploadsS3Storage } = await import('./uploadx-s3-storage.js')

    return buildResumableUploadsS3Storage({
      storageOptions,
      subPrefix: options.stagingSubPrefix,

      // Uploads deleted by the client, expired, or initialized again (the existing upload is resumed)
      onMetadataDiscarded: metadata => removeStagedImages(metadata)
    })
  }

  return new DiskStorage({
    ...storageOptions,

    uploadDir: getResumableUploadPath(),
    namingFunction: file => {
      const extension = options.buildFileExtension({ filename: file.metadata.filename, mimetype: file.contentType })

      return `${file.userId}-${file.id}${extension}`
    }
  })
}
