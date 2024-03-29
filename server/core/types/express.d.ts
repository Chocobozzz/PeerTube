import { HttpMethodType, PeerTubeProblemDocumentData, ServerLogLevel, VideoCreate } from '@peertube/peertube-models'
import { RegisterServerAuthExternalOptions } from '@server/types/index.js'
import {
  MAbuseMessage,
  MAbuseReporter,
  MAccountBlocklist,
  MActorFollowActorsDefault,
  MActorUrl,
  MChannelBannerAccountDefault,
  MChannelSyncChannel,
  MRegistration,
  MStreamingPlaylist,
  MUserAccountUrl,
  MUserExport,
  MVideoChangeOwnershipFull,
  MVideoFile,
  MVideoFormattableDetails,
  MVideoId,
  MVideoImmutable,
  MVideoLiveFormattable,
  MVideoPassword,
  MVideoPlaylistFull,
  MVideoPlaylistFullSummary
} from '@server/types/models/index.js'
import { MOAuthTokenUser } from '@server/types/models/oauth/oauth-token.js'
import { MPlugin, MServer, MServerBlocklist } from '@server/types/models/server.js'
import { MVideoImportDefault } from '@server/types/models/video/video-import.js'
import { MVideoPlaylistElement, MVideoPlaylistElementVideoUrlPlaylistPrivacy } from '@server/types/models/video/video-playlist-element.js'
import { MAccountVideoRateAccountVideo } from '@server/types/models/video/video-rate.js'
import { Metadata, File as UploadXFile } from '@uploadx/core'
import { FfprobeData } from 'fluent-ffmpeg'
import { OutgoingHttpHeaders } from 'http'
import { Writable } from 'stream'
import { RegisteredPlugin } from '../../lib/plugins/plugin-manager.js'
import {
  MAccountDefault,
  MActorAccountChannelId,
  MActorFollowActorsDefaultSubscription,
  MActorFull,
  MComment,
  MCommentOwnerVideoReply,
  MUserDefault,
  MVideoBlacklist,
  MVideoCaptionVideo,
  MVideoFullLight,
  MVideoRedundancyVideo,
  MVideoShareActor,
  MVideoThumbnail
} from './models/index.js'
import { MRunner, MRunnerJobRunner, MRunnerRegistrationToken } from './models/runners/index.js'
import { MVideoSource } from './models/video/video-source.js'

declare module 'express' {
  export interface Request {
    query: any
    method: HttpMethodType
    rawBody: Buffer // Allow plugin routes to access the raw body
  }

  // ---------------------------------------------------------------------------

  // Upload using multer or uploadx middleware
  export type MulterOrUploadXFile = UploadXFile | Express.Multer.File

  export type UploadFiles = { [fieldname: string]: MulterOrUploadXFile[] } | MulterOrUploadXFile[]

  // Partial object used by some functions to check the file mimetype/extension
  export type UploadFileForCheck = {
    originalname: string
    mimetype: string
    size: number
  }

  export type UploadFilesForCheck = { [fieldname: string]: UploadFileForCheck[] } | UploadFileForCheck[]

  // ---------------------------------------------------------------------------

  // Upload file with a duration added by our middleware
  export type VideoLegacyUploadFile = Pick<Express.Multer.File, 'path' | 'filename' | 'size', 'originalname'> & {
    duration: number
  }

  // Our custom UploadXFile object using our custom metadata
  export type CustomUploadXFile <T extends Metadata> = UploadXFile & { metadata: T }

  export type EnhancedUploadXFile = CustomUploadXFile<Metadata> & {
    duration?: number // If video file
    path: string
    filename: string
    originalname: string
  }

  // Extends Metadata property of UploadX object when uploading a video
  export type UploadNewVideoXFileMetadata = Metadata & VideoCreate & {
    previewfile: Express.Multer.File[]
    thumbnailfile: Express.Multer.File[]
  }

  export type UploadNewVideoUploadXFile = EnhancedUploadXFile & CustomUploadXFile<UploadNewVideoXFileMetadata>

  // Extends Response with added functions and potential variables passed by middlewares
  interface Response {
    fail: (options: {
      message: string

      title?: string
      status?: number
      type?: ServerErrorCode | string
      instance?: string

      data?: PeerTubeProblemDocumentData

      logLevel?: ServerLogLevel // Default debug
      tags?: string[]
    }) => void

    locals: {
      requestStart: number

      apicacheGroups: string[]

      apicache: {
        content: string | Buffer
        write: Writable['write']
        writeHead: Response['writeHead']
        end: Response['end']
        cacheable: boolean
        headers: OutgoingHttpHeaders
      }

      docUrl?: string

      ffprobe?: FfprobeData

      videoAPI?: MVideoFormattableDetails
      videoAll?: MVideoFullLight
      onlyImmutableVideo?: MVideoImmutable
      onlyVideo?: MVideoThumbnail
      videoId?: MVideoId

      videoLive?: MVideoLiveFormattable
      videoLiveSession?: MVideoLiveSession

      videoShare?: MVideoShareActor

      videoSource?: MVideoSource

      videoFile?: MVideoFile

      uploadVideoFileResumableMetadata?: {
        mimetype: string
        size: number
        originalname: string
      }
      uploadVideoFileResumable?: UploadNewVideoUploadXFile
      updateVideoFileResumable?: EnhancedUploadXFile
      importUserFileResumable?: EnhancedUploadXFile

      videoImport?: MVideoImportDefault

      videoBlacklist?: MVideoBlacklist

      videoCaption?: MVideoCaptionVideo

      abuse?: MAbuseReporter
      abuseMessage?: MAbuseMessage

      videoStreamingPlaylist?: MStreamingPlaylist

      videoChannel?: MChannelBannerAccountDefault
      videoChannelSync?: MChannelSyncChannel

      videoPlaylistFull?: MVideoPlaylistFull
      videoPlaylistSummary?: MVideoPlaylistFullSummary

      videoPlaylistElement?: MVideoPlaylistElement
      videoPlaylistElementAP?: MVideoPlaylistElementVideoUrlPlaylistPrivacy

      accountVideoRate?: MAccountVideoRateAccountVideo

      videoCommentFull?: MCommentOwnerVideoReply
      videoCommentThread?: MComment

      videoPassword?: MVideoPassword

      follow?: MActorFollowActorsDefault
      subscription?: MActorFollowActorsDefaultSubscription

      nextOwner?: MAccountDefault
      videoChangeOwnership?: MVideoChangeOwnershipFull

      account?: MAccountDefault

      actorUrl?: MActorUrl
      actorFull?: MActorFull

      user?: MUserDefault
      userRegistration?: MRegistration

      server?: MServer

      videoRedundancy?: MVideoRedundancyVideo

      accountBlock?: MAccountBlocklist
      serverBlock?: MServerBlocklist

      oauth?: {
        token: MOAuthTokenUser
      }

      signature?: {
        actor: MActorAccountChannelId
      }

      videoFileToken?: {
        user: MUserAccountUrl
      }

      authenticated?: boolean

      registeredPlugin?: RegisteredPlugin

      externalAuth?: RegisterServerAuthExternalOptions

      plugin?: MPlugin

      localViewerFull?: MLocalVideoViewerWithWatchSections

      runner?: MRunner
      runnerRegistrationToken?: MRunnerRegistrationToken
      runnerJob?: MRunnerJobRunner

      userExport?: MUserExport
    }
  }
}
