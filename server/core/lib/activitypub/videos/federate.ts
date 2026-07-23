import { forceNumber } from '@peertube/peertube-core-utils'
import { VideoPrivacy, VideoPrivacyType, VideoState, VideoStateType } from '@peertube/peertube-models'
import { afterCommitIfTransaction } from '@server/helpers/database-utils.js'
import { CONFIG } from '@server/initializers/config.js'
import { CreateJobOptions, CreateJobTypeAndPayload, JobQueue } from '@server/lib/job-queue/job-queue.js'
import { MActor, MActorId, MVideo, MVideoAP, MVideoUUID, MVideoWithBlacklistRights } from '@server/types/models/index.js'
import { Transaction } from 'sequelize'
import { sendCreateVideo, sendUpdateVideo } from '../send/index.js'
import { isSharedByServer, shareByServerIfNeeded, shareByVideoChannelIfNeeded } from '../share.js'

// Enough to know if it's worth creating a federation job for this video
export type MVideoToFederate = MVideoUUID & Pick<MVideo, 'privacy' | 'state'>

export type FederateVideoJobOptions = {
  video: MVideoToFederate

  // Actor that overrides the video channel account actor to send the update activity
  overriddenBy?: MActorId
}

// bullmq drops a deduplicated job before storing it, so a flow job would vanish while its children still reference it as their parent
export function buildNonDuplicatedFederateVideoJob (options: FederateVideoJobOptions): CreateJobTypeAndPayload & CreateJobOptions {
  const { video, overriddenBy } = options

  return {
    type: 'federate-video',
    payload: {
      videoUUID: video.uuid,
      overriddenByActorId: overriddenBy?.id
    }
  }
}

// Deduplicate the job by video, so jobs scheduled here don't federate the same video in parallel
// `keepLastIfActive` also guarantees a change that occurred while the video was being federated is federated afterwards
export function scheduleVideoFederation (options: FederateVideoJobOptions & { transaction?: Transaction }) {
  const { video, overriddenBy, transaction } = options

  // Check federation possibility early
  // Delay blacklist check in job execution
  if (!isPrivacyForFederation(video.privacy) || !isStateForFederation(video.state)) return

  // Keep a dedicated key per overriding actor: a job deduplicated against a *waiting* one is dropped, and we would
  // then lose the update sent on behalf of that actor (its followers would never be notified)
  const deduplicationId = overriddenBy
    ? `federate-video-${video.uuid}-by-${overriddenBy.id}`
    : `federate-video-${video.uuid}`

  const job = {
    ...buildNonDuplicatedFederateVideoJob(options),

    deduplicationId,
    deduplicationKeepLastIfActive: true
  }

  afterCommitIfTransaction(transaction, () => JobQueue.Instance.createJobAsync(job))
}

export async function federateVideoIfNeeded (options: {
  video: MVideoAP
  overriddenByActor?: MActor
  transaction?: Transaction
}) {
  const { video, overriddenByActor, transaction } = options

  if (!canVideoBeFederated(video)) return

  const alreadyShared = await isSharedByServer({ video, transaction })

  if (!alreadyShared) {
    await sendCreateVideo(video, transaction)

    await Promise.all([
      shareByServerIfNeeded({ video, skipFederation: false, transaction }),
      shareByVideoChannelIfNeeded({ video, skipFederation: false, transaction })
    ])
  } else {
    // Keep send update after these functions, so it takes into account new shares created
    await Promise.all([
      shareByServerIfNeeded({ video, skipFederation: true, transaction }),
      shareByVideoChannelIfNeeded({ video, skipFederation: true, transaction })
    ])

    await sendUpdateVideo(video, transaction, overriddenByActor)
  }
}

export function canVideoBeFederated (video: MVideoWithBlacklistRights) {
  // Check this is not a blacklisted video
  if (video.isBlacklisted() === true && video.VideoBlacklist.unfederated === true) return false

  // Check the video is public/unlisted and published
  return isPrivacyForFederation(video.privacy) && isStateForFederation(video.state)
}

export function isPrivacyForFederation (privacy: VideoPrivacyType) {
  const castedPrivacy = forceNumber(privacy)

  return castedPrivacy === VideoPrivacy.PUBLIC ||
    (CONFIG.FEDERATION.VIDEOS.FEDERATE_UNLISTED === true && castedPrivacy === VideoPrivacy.UNLISTED)
}

export function isStateForFederation (state: VideoStateType) {
  const castedState = forceNumber(state)

  return castedState === VideoState.PUBLISHED || castedState === VideoState.WAITING_FOR_LIVE || castedState === VideoState.LIVE_ENDED
}
