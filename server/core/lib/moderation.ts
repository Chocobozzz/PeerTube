import express, { VideoLegacyUploadFile } from 'express'
import { PathLike } from 'fs-extra/esm'
import { Transaction } from 'sequelize'
import { AbuseAuditView, auditLoggerFactory } from '@server/helpers/audit-logger.js'
import { afterCommitIfTransaction } from '@server/helpers/database-utils.js'
import { logger } from '@server/helpers/logger.js'
import { AbuseModel } from '@server/models/abuse/abuse.js'
import { VideoAbuseModel } from '@server/models/abuse/video-abuse.js'
import { VideoCommentAbuseModel } from '@server/models/abuse/video-comment-abuse.js'
import { VideoFileModel } from '@server/models/video/video-file.js'
import { FilteredModelAttributes } from '@server/types/index.js'
import {
  MAbuseFull,
  MAccountDefault,
  MAccountLight,
  MComment,
  MCommentAbuseAccountVideo,
  MCommentOwnerVideo,
  MUser,
  MUserDefault,
  MVideoAbuseVideoFull,
  MVideoAccountLightBlacklistAllFiles
} from '@server/types/models/index.js'
import { LiveVideoCreate, VideoCommentCreate, VideoCreate, VideoImportCreate } from '@peertube/peertube-models'
import { UserModel } from '../models/user/user.js'
import { VideoCommentModel } from '../models/video/video-comment.js'
import { VideoModel } from '../models/video/video.js'
import { sendAbuse } from './activitypub/send/send-flag.js'
import { Notifier } from './notifier/index.js'

export type AcceptResult = {
  accepted: boolean
  errorMessage?: string
}

// ---------------------------------------------------------------------------

// Stub function that can be filtered by plugins
function isLocalVideoFileAccepted (object: {
  videoBody: VideoCreate
  videoFile: VideoLegacyUploadFile
  user: MUserDefault
}): AcceptResult {
  return { accepted: true }
}

// ---------------------------------------------------------------------------

// Stub function that can be filtered by plugins
function isLocalLiveVideoAccepted (object: {
  liveVideoBody: LiveVideoCreate
  user: UserModel
}): AcceptResult {
  return { accepted: true }
}

// ---------------------------------------------------------------------------

// Stub function that can be filtered by plugins
function isLocalVideoThreadAccepted (_object: {
  req: express.Request
  commentBody: VideoCommentCreate
  video: VideoModel
  user: UserModel
}): AcceptResult {
  return { accepted: true }
}

// Stub function that can be filtered by plugins
function isLocalVideoCommentReplyAccepted (_object: {
  req: express.Request
  commentBody: VideoCommentCreate
  parentComment: VideoCommentModel
  video: VideoModel
  user: UserModel
}): AcceptResult {
  return { accepted: true }
}

// ---------------------------------------------------------------------------

// Stub function that can be filtered by plugins
function isRemoteVideoCommentAccepted (_object: {
  comment: MComment
}): AcceptResult {
  return { accepted: true }
}

// ---------------------------------------------------------------------------

// Stub function that can be filtered by plugins
function isPreImportVideoAccepted (object: {
  videoImportBody: VideoImportCreate
  user: MUser
}): AcceptResult {
  return { accepted: true }
}

// Stub function that can be filtered by plugins
function isPostImportVideoAccepted (object: {
  videoFilePath: PathLike
  videoFile: VideoFileModel
  user: MUser
}): AcceptResult {
  return { accepted: true }
}

// ---------------------------------------------------------------------------

async function createVideoAbuse (options: {
  baseAbuse: FilteredModelAttributes<AbuseModel>
  videoInstance: MVideoAccountLightBlacklistAllFiles
  startAt: number
  endAt: number
  transaction: Transaction
  reporterAccount: MAccountDefault
  skipNotification: boolean
}) {
  const { baseAbuse, videoInstance, startAt, endAt, transaction, reporterAccount, skipNotification } = options

  const associateFun = async (abuseInstance: MAbuseFull) => {
    const videoAbuseInstance: MVideoAbuseVideoFull = await VideoAbuseModel.create({
      abuseId: abuseInstance.id,
      videoId: videoInstance.id,
      startAt,
      endAt
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
    skipNotification,
    associateFun
  })
}

function createVideoCommentAbuse (options: {
  baseAbuse: FilteredModelAttributes<AbuseModel>
  commentInstance: MCommentOwnerVideo
  transaction: Transaction
  reporterAccount: MAccountDefault
  skipNotification: boolean
}) {
  const { baseAbuse, commentInstance, transaction, reporterAccount, skipNotification } = options

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
    skipNotification,
    associateFun
  })
}

function createAccountAbuse (options: {
  baseAbuse: FilteredModelAttributes<AbuseModel>
  accountInstance: MAccountDefault
  transaction: Transaction
  reporterAccount: MAccountDefault
  skipNotification: boolean
}) {
  const { baseAbuse, accountInstance, transaction, reporterAccount, skipNotification } = options

  const associateFun = () => {
    return Promise.resolve({ isOwned: accountInstance.isOwned() })
  }

  return createAbuse({
    base: baseAbuse,
    reporterAccount,
    flaggedAccount: accountInstance,
    transaction,
    skipNotification,
    associateFun
  })
}

// ---------------------------------------------------------------------------

export {
  isLocalLiveVideoAccepted,

  isLocalVideoFileAccepted,
  isLocalVideoThreadAccepted,
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
  associateFun: (abuseInstance: MAbuseFull) => Promise<{ isOwned: boolean }>
  skipNotification: boolean
  transaction: Transaction
}) {
  const { base, reporterAccount, flaggedAccount, associateFun, transaction, skipNotification } = options
  const auditLogger = auditLoggerFactory('abuse')

  const abuseAttributes = Object.assign({}, base, { flaggedAccountId: flaggedAccount.id })
  const abuseInstance: MAbuseFull = await AbuseModel.create(abuseAttributes, { transaction })

  abuseInstance.ReporterAccount = reporterAccount
  abuseInstance.FlaggedAccount = flaggedAccount

  const { isOwned } = await associateFun(abuseInstance)

  if (isOwned === false) {
    sendAbuse(reporterAccount.Actor, abuseInstance, abuseInstance.FlaggedAccount, transaction)
  }

  const abuseJSON = abuseInstance.toFormattedAdminJSON()
  auditLogger.create(reporterAccount.Actor.getIdentifier(), new AbuseAuditView(abuseJSON))

  if (!skipNotification) {
    afterCommitIfTransaction(transaction, () => {
      Notifier.Instance.notifyOnNewAbuse({
        abuse: abuseJSON,
        abuseInstance,
        reporter: reporterAccount.Actor.getIdentifier()
      })
    })
  }

  logger.info('Abuse report %d created.', abuseInstance.id)

  return abuseJSON
}
