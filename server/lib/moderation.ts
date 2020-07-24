import { PathLike } from 'fs-extra'
import { Transaction } from 'sequelize/types'
import { AbuseAuditView, auditLoggerFactory } from '@server/helpers/audit-logger'
import { logger } from '@server/helpers/logger'
import { AbuseModel } from '@server/models/abuse/abuse'
import { VideoAbuseModel } from '@server/models/abuse/video-abuse'
import { VideoCommentAbuseModel } from '@server/models/abuse/video-comment-abuse'
import { VideoFileModel } from '@server/models/video/video-file'
import { FilteredModelAttributes } from '@server/types'
import {
  MAbuseFull,
  MAccountDefault,
  MAccountLight,
  MCommentAbuseAccountVideo,
  MCommentOwnerVideo,
  MUser,
  MVideoAbuseVideoFull,
  MVideoAccountLightBlacklistAllFiles
} from '@server/types/models'
import { ActivityCreate } from '../../shared/models/activitypub'
import { VideoTorrentObject } from '../../shared/models/activitypub/objects'
import { VideoCommentObject } from '../../shared/models/activitypub/objects/video-comment-object'
import { VideoCreate, VideoImportCreate } from '../../shared/models/videos'
import { VideoCommentCreate } from '../../shared/models/videos/video-comment.model'
import { UserModel } from '../models/account/user'
import { ActorModel } from '../models/activitypub/actor'
import { VideoModel } from '../models/video/video'
import { VideoCommentModel } from '../models/video/video-comment'
import { sendAbuse } from './activitypub/send/send-flag'
import { Notifier } from './notifier'

export type AcceptResult = {
  accepted: boolean
  errorMessage?: string
}

// Can be filtered by plugins
function isLocalVideoAccepted (object: {
  videoBody: VideoCreate
  videoFile: Express.Multer.File & { duration?: number }
  user: UserModel
}): AcceptResult {
  return { accepted: true }
}

function isLocalVideoThreadAccepted (_object: {
  commentBody: VideoCommentCreate
  video: VideoModel
  user: UserModel
}): AcceptResult {
  return { accepted: true }
}

function isLocalVideoCommentReplyAccepted (_object: {
  commentBody: VideoCommentCreate
  parentComment: VideoCommentModel
  video: VideoModel
  user: UserModel
}): AcceptResult {
  return { accepted: true }
}

function isRemoteVideoAccepted (_object: {
  activity: ActivityCreate
  videoAP: VideoTorrentObject
  byActor: ActorModel
}): AcceptResult {
  return { accepted: true }
}

function isRemoteVideoCommentAccepted (_object: {
  activity: ActivityCreate
  commentAP: VideoCommentObject
  byActor: ActorModel
}): AcceptResult {
  return { accepted: true }
}

function isPreImportVideoAccepted (object: {
  videoImportBody: VideoImportCreate
  user: MUser
}): AcceptResult {
  return { accepted: true }
}

function isPostImportVideoAccepted (object: {
  videoFilePath: PathLike
  videoFile: VideoFileModel
  user: MUser
}): AcceptResult {
  return { accepted: true }
}

async function createVideoAbuse (options: {
  baseAbuse: FilteredModelAttributes<AbuseModel>
  videoInstance: MVideoAccountLightBlacklistAllFiles
  startAt: number
  endAt: number
  transaction: Transaction
  reporterAccount: MAccountDefault
}) {
  const { baseAbuse, videoInstance, startAt, endAt, transaction, reporterAccount } = options

  const associateFun = async (abuseInstance: MAbuseFull) => {
    const videoAbuseInstance: MVideoAbuseVideoFull = await VideoAbuseModel.create({
      abuseId: abuseInstance.id,
      videoId: videoInstance.id,
      startAt: startAt,
      endAt: endAt
    }, { transaction })

    videoAbuseInstance.Video = videoInstance
    abuseInstance.VideoAbuse = videoAbuseInstance

    return { isOwned: videoInstance.isOwned() }
  }

  return createAbuse({
    base: baseAbuse,
    reporterAccount,
    flaggedAccount: videoInstance.VideoChannel.Account,
    transaction,
    associateFun
  })
}

function createVideoCommentAbuse (options: {
  baseAbuse: FilteredModelAttributes<AbuseModel>
  commentInstance: MCommentOwnerVideo
  transaction: Transaction
  reporterAccount: MAccountDefault
}) {
  const { baseAbuse, commentInstance, transaction, reporterAccount } = options

  const associateFun = async (abuseInstance: MAbuseFull) => {
    const commentAbuseInstance: MCommentAbuseAccountVideo = await VideoCommentAbuseModel.create({
      abuseId: abuseInstance.id,
      videoCommentId: commentInstance.id
    }, { transaction })

    commentAbuseInstance.VideoComment = commentInstance
    abuseInstance.VideoCommentAbuse = commentAbuseInstance

    return { isOwned: commentInstance.isOwned() }
  }

  return createAbuse({
    base: baseAbuse,
    reporterAccount,
    flaggedAccount: commentInstance.Account,
    transaction,
    associateFun
  })
}

function createAccountAbuse (options: {
  baseAbuse: FilteredModelAttributes<AbuseModel>
  accountInstance: MAccountDefault
  transaction: Transaction
  reporterAccount: MAccountDefault
}) {
  const { baseAbuse, accountInstance, transaction, reporterAccount } = options

  const associateFun = async () => {
    return { isOwned: accountInstance.isOwned() }
  }

  return createAbuse({
    base: baseAbuse,
    reporterAccount,
    flaggedAccount: accountInstance,
    transaction,
    associateFun
  })
}

export {
  isLocalVideoAccepted,
  isLocalVideoThreadAccepted,
  isRemoteVideoAccepted,
  isRemoteVideoCommentAccepted,
  isLocalVideoCommentReplyAccepted,
  isPreImportVideoAccepted,
  isPostImportVideoAccepted,

  createAbuse,
  createVideoAbuse,
  createVideoCommentAbuse,
  createAccountAbuse
}

// ---------------------------------------------------------------------------

async function createAbuse (options: {
  base: FilteredModelAttributes<AbuseModel>
  reporterAccount: MAccountDefault
  flaggedAccount: MAccountLight
  associateFun: (abuseInstance: MAbuseFull) => Promise<{ isOwned: boolean} >
  transaction: Transaction
}) {
  const { base, reporterAccount, flaggedAccount, associateFun, transaction } = options
  const auditLogger = auditLoggerFactory('abuse')

  const abuseAttributes = Object.assign({}, base, { flaggedAccountId: flaggedAccount.id })
  const abuseInstance: MAbuseFull = await AbuseModel.create(abuseAttributes, { transaction })

  abuseInstance.ReporterAccount = reporterAccount
  abuseInstance.FlaggedAccount = flaggedAccount

  const { isOwned } = await associateFun(abuseInstance)

  if (isOwned === false) {
    await sendAbuse(reporterAccount.Actor, abuseInstance, abuseInstance.FlaggedAccount, transaction)
  }

  const abuseJSON = abuseInstance.toFormattedAdminJSON()
  auditLogger.create(reporterAccount.Actor.getIdentifier(), new AbuseAuditView(abuseJSON))

  Notifier.Instance.notifyOnNewAbuse({
    abuse: abuseJSON,
    abuseInstance,
    reporter: reporterAccount.Actor.getIdentifier()
  })

  logger.info('Abuse report %d created.', abuseInstance.id)

  return abuseJSON
}
