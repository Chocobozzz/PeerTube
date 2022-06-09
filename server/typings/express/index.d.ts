
import { RegisterServerAuthExternalOptions } from '@server/types'
import {
  MAbuseMessage,
  MAbuseReporter,
  MAccountBlocklist,
  MActorFollowActorsDefault,
  MActorUrl,
  MChannelBannerAccountDefault,
  MStreamingPlaylist,
  MVideoChangeOwnershipFull,
  MVideoFile,
  MVideoFormattableDetails,
  MVideoId,
  MVideoImmutable,
  MVideoLive,
  MVideoPlaylistFull,
  MVideoPlaylistFullSummary
} from '@server/types/models'
import { MOAuthTokenUser } from '@server/types/models/oauth/oauth-token'
import { MPlugin, MServer, MServerBlocklist } from '@server/types/models/server'
import { MVideoImportDefault } from '@server/types/models/video/video-import'
import { MVideoPlaylistElement, MVideoPlaylistElementVideoUrlPlaylistPrivacy } from '@server/types/models/video/video-playlist-element'
import { MAccountVideoRateAccountVideo } from '@server/types/models/video/video-rate'
import { HttpMethod } from '@shared/core-utils/miscs/http-methods'
import { PeerTubeProblemDocumentData, ServerErrorCode, VideoCreate } from '@shared/models'
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
} from '../../types/models'

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
  }

  export type UploadFilesForCheck = {
    [fieldname: string]: UploadFileForCheck[]
  } | UploadFileForCheck[]

  // Upload file with a duration added by our middleware
  export type VideoUploadFile = Pick<Express.Multer.File, 'path' | 'filename' | 'size'> & {
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
  }

  // Extends Response with added functions and potential variables passed by middlewares
  interface Response {
    fail: (options: {
      message: string

      title?: string
      status?: number
      type?: ServerErrorCode
      instance?: string

      data?: PeerTubeProblemDocumentData
    }) => void

    locals: {
      docUrl?: string

      videoAPI?: MVideoFormattableDetails
      videoAll?: MVideoFullLight
      onlyImmutableVideo?: MVideoImmutable
      onlyVideo?: MVideoThumbnail
      videoId?: MVideoId

      videoLive?: MVideoLive

      videoShare?: MVideoShareActor

      videoFile?: MVideoFile

      videoFileResumable?: EnhancedUploadXFile

      videoImport?: MVideoImportDefault

      videoBlacklist?: MVideoBlacklist

      videoCaption?: MVideoCaptionVideo

      abuse?: MAbuseReporter
      abuseMessage?: MAbuseMessage

      videoStreamingPlaylist?: MStreamingPlaylist

      videoChannel?: MChannelBannerAccountDefault

      videoPlaylistFull?: MVideoPlaylistFull
      videoPlaylistSummary?: MVideoPlaylistFullSummary

      videoPlaylistElement?: MVideoPlaylistElement
      videoPlaylistElementAP?: MVideoPlaylistElementVideoUrlPlaylistPrivacy

      accountVideoRate?: MAccountVideoRateAccountVideo

      videoCommentFull?: MCommentOwnerVideoReply
      videoCommentThread?: MComment

      follow?: MActorFollowActorsDefault
      subscription?: MActorFollowActorsDefaultSubscription

      nextOwner?: MAccountDefault
      videoChangeOwnership?: MVideoChangeOwnershipFull

      account?: MAccountDefault

      actorUrl?: MActorUrl
      actorFull?: MActorFull

      user?: MUserDefault

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

      authenticated?: boolean

      registeredPlugin?: RegisteredPlugin

      externalAuth?: RegisterServerAuthExternalOptions

      plugin?: MPlugin
    }
  }
}
