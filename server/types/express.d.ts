import { OutgoingHttpHeaders } from 'http'
import { Writable } from 'stream'
import { RegisterServerAuthExternalOptions } from '@server/types'
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
  MVideoChangeOwnershipFull,
  MVideoFile,
  MVideoFormattableDetails,
  MVideoId,
  MVideoImmutable,
  MVideoLiveFormattable,
  MVideoPassword,
  MVideoPlaylistFull,
  MVideoPlaylistFullSummary
} from '@server/types/models'
import { MOAuthTokenUser } from '@server/types/models/oauth/oauth-token'
import { MPlugin, MServer, MServerBlocklist } from '@server/types/models/server'
import { MVideoImportDefault } from '@server/types/models/video/video-import'
import { MVideoPlaylistElement, MVideoPlaylistElementVideoUrlPlaylistPrivacy } from '@server/types/models/video/video-playlist-element'
import { MAccountVideoRateAccountVideo } from '@server/types/models/video/video-rate'
import { HttpMethod, PeerTubeProblemDocumentData, ServerErrorCode, VideoCreate } from '@shared/models'
import { File as UploadXFile, Metadata } from '@uploadx/core'
import { RegisteredPlugin } from '../../lib/plugins/plugin-manager'
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
} from './models'
import { MRunner, MRunnerJobRunner, MRunnerRegistrationToken } from './models/runners'
import { MVideoSource } from './models/video/video-source'

declare module 'express' {
  export interface Request {
    query: any
    method: HttpMethod
  }

  // Upload using multer or uploadx middleware
  export type MulterOrUploadXFile = UploadXFile | Express.Multer.File

  export type UploadFiles = {
    [fieldname: string]: MulterOrUploadXFile[]
  } | MulterOrUploadXFile[]

  // Partial object used by some functions to check the file mimetype/extension
  export type UploadFileForCheck = {
    originalname: string
    mimetype: string
    size: number
  }

  export type UploadFilesForCheck = {
    [fieldname: string]: UploadFileForCheck[]
  } | UploadFileForCheck[]

  // Upload file with a duration added by our middleware
  export type VideoUploadFile = Pick<Express.Multer.File, 'path' | 'filename' | 'size', 'originalname'> & {
    duration: number
  }

  // Extends Metadata property of UploadX object
  export type UploadXFileMetadata = Metadata & VideoCreate & {
    previewfile: Express.Multer.File[]
    thumbnailfile: Express.Multer.File[]
  }

  // Our custom UploadXFile object using our custom metadata
  export type CustomUploadXFile <T extends Metadata> = UploadXFile & { metadata: T }

  export type EnhancedUploadXFile = CustomUploadXFile<UploadXFileMetadata> & {
    duration: number
    path: string
    filename: string
    originalname: string
  }

  // Extends Response with added functions and potential variables passed by middlewares
  interface Response {
    fail: (options: {
      message: string

      title?: string
      status?: number
      type?: ServerErrorCode | string
      instance?: string

      data?: PeerTubeProblemDocumentData

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

      videoFileResumable?: EnhancedUploadXFile

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
    }
  }
}
