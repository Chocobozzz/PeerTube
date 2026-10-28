import {
  Account,
  AccountSummary,
  ActorImage,
  AuditLogEntityType,
  AuditLogEntityTypeType,
  ChangeOwnership,
  CustomConfig,
  RegisterServerSettingOptions,
  VideoChannel,
  VideoChannelCollaborator,
  VideoChannelSummary,
  VideoChannelSync,
  VideoComment,
  VideoDetails,
  VideoImport
} from '@peertube/peertube-models'
import { CONFIG } from '@server/initializers/config.js'
import { MAbuseFull, MAccountLight, MActor, MChannelId, MUserFormattable } from '@server/types/models/index.js'
import { createHmac } from 'crypto'
import { AuditLogEntity } from './audit-log.js'

type IdSummary = { id: number }
type VideoSummary = { id: number, uuid: string, name: string }
type UserSummary = { id: number, username: string }
type ChannelSummary = { id: number, name: string }

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------

export function buildVideoAuditEntity (video: VideoDetails) {
  return buildEntity(AuditLogEntityType.VIDEO, video.id, {
    id: video.id,
    uuid: video.uuid,
    name: video.name,
    description: video.description,
    support: video.support,
    tags: video.tags,
    category: video.category,
    licence: video.licence,
    language: video.language,
    privacy: video.privacy,
    nsfw: video.nsfw,
    nsfwFlags: video.nsfwFlags,
    nsfwSummary: video.nsfwSummary,
    commentsPolicy: video.commentsPolicy,
    recommendationScope: video.recommendationScope,
    aiUsage: video.aiUsage,
    downloadEnabled: video.downloadEnabled,
    waitTranscoding: video.waitTranscoding,
    scheduledUpdate: video.scheduledUpdate ?? null,
    isLive: video.isLive,
    isLocal: video.isLocal,
    duration: video.duration,
    originallyPublishedAt: video.originallyPublishedAt,
    publishedAt: video.publishedAt,
    createdAt: video.createdAt,
    account: buildActorSummary(video.account),
    channel: buildActorSummary(video.channel)
  })
}

export function buildVideoImportAuditEntity (videoImport: VideoImport) {
  return buildEntity(AuditLogEntityType.VIDEO_IMPORT, videoImport.id, {
    id: videoImport.id,
    targetUrl: videoImport.targetUrl,
    magnetUri: videoImport.magnetUri,
    torrentName: videoImport.torrentName,
    state: videoImport.state,
    video: videoImport.video
      ? buildVideoSummary(videoImport.video)
      : null,
    videoChannelSync: videoImport.videoChannelSync ?? null,
    createdAt: videoImport.createdAt
  })
}

export function buildVideoLiveAuditEntity (options: {
  video: VideoSummary
  saveReplay: boolean
  replayPrivacy: number | null
  permanentLive: boolean
  latencyMode: number
  dvrWindow: number
  schedules: { startAt: Date | string }[]
}) {
  const { video } = options

  return buildEntity(AuditLogEntityType.VIDEO_LIVE, video.id, {
    video: buildVideoSummary(video),
    saveReplay: options.saveReplay,
    replaySettings: options.saveReplay
      ? { privacy: options.replayPrivacy }
      : null,
    permanentLive: options.permanentLive,
    latencyMode: options.latencyMode,
    dvrWindow: options.dvrWindow,
    schedules: (options.schedules || []).map(s => ({ startAt: s.startAt }))
  })
}

export function buildVideoSourceAuditEntity (options: {
  video: VideoSummary
  inputFilename: string
}) {
  return buildEntity(AuditLogEntityType.VIDEO_SOURCE, options.video.id, {
    video: buildVideoSummary(options.video),
    inputFilename: options.inputFilename
  })
}

export function buildVideoFileAuditEntity (options: {
  video: VideoSummary
  type: 'hls' | 'web-video'

  // Null if all files of this type are deleted
  videoFileId: number | null
}) {
  return buildEntity(AuditLogEntityType.VIDEO_FILE, options.videoFileId, {
    video: buildVideoSummary(options.video),
    type: options.type,
    videoFileId: options.videoFileId
  })
}

export function buildVideoCaptionAuditEntity (options: {
  video: VideoSummary
  language: string
}) {
  return buildEntity(AuditLogEntityType.VIDEO_CAPTION, options.video.id, {
    video: buildVideoSummary(options.video),
    language: options.language
  })
}

export function buildVideoChaptersAuditEntity (options: {
  video: VideoSummary
  chapters: { timecode: number, title: string }[]
}) {
  return buildEntity(AuditLogEntityType.VIDEO_CHAPTERS, options.video.id, {
    video: buildVideoSummary(options.video),
    chapters: options.chapters.map(c => ({ timecode: c.timecode, title: c.title }))
  })
}

// Passwords are secrets: never store them
export function buildVideoPasswordAuditEntity (options: {
  video: VideoSummary

  // Null when the whole password list is replaced
  passwordId: number | null
  passwordsCount?: number
}) {
  return buildEntity(AuditLogEntityType.VIDEO_PASSWORD, options.passwordId, {
    video: buildVideoSummary(options.video),
    passwordId: options.passwordId,
    passwordsCount: options.passwordsCount ?? null
  })
}

export function buildVideoEmbedPrivacyAuditEntity (options: {
  video: VideoSummary
  policy: number
  domains: string[]
}) {
  return buildEntity(AuditLogEntityType.VIDEO_EMBED_PRIVACY, options.video.id, {
    video: buildVideoSummary(options.video),
    policy: options.policy,
    domains: options.domains
  })
}

export function buildVideoTranscodingAuditEntity (options: {
  video: VideoSummary
  transcodingType: string
  resolutions: number[]
}) {
  return buildEntity(AuditLogEntityType.VIDEO_TRANSCODING, options.video.id, {
    video: buildVideoSummary(options.video),
    transcodingType: options.transcodingType,
    resolutions: options.resolutions
  })
}

export function buildVideoTranscriptionAuditEntity (options: {
  video: VideoSummary
  forceTranscription: boolean
}) {
  return buildEntity(AuditLogEntityType.VIDEO_TRANSCRIPTION, options.video.id, {
    video: buildVideoSummary(options.video),
    forceTranscription: options.forceTranscription
  })
}

export function buildVideoStudioEditionAuditEntity (options: {
  video: VideoSummary
  tasks: { name: string, options?: Record<string, any> }[]
}) {
  return buildEntity(AuditLogEntityType.VIDEO_STUDIO_EDITION, options.video.id, {
    video: buildVideoSummary(options.video),
    // Task files are uploaded files: only keep the other options
    tasks: options.tasks.map(t => ({
      name: t.name,
      options: Object.fromEntries(Object.entries(t.options || {}).filter(([ key ]) => key !== 'file'))
    }))
  })
}

export function buildVideoPlayerSettingsAuditEntity (options: {
  video: VideoSummary
  theme: string | null
}) {
  return buildEntity(AuditLogEntityType.VIDEO_PLAYER_SETTINGS, options.video.id, {
    video: buildVideoSummary(options.video),
    theme: options.theme
  })
}

export function buildOwnershipChangeAuditEntity (ownershipChange: ChangeOwnership) {
  return buildEntity(AuditLogEntityType.OWNERSHIP_CHANGE, ownershipChange.id, {
    id: ownershipChange.id,
    state: ownershipChange.state,
    initiatorAccount: buildActorSummary(ownershipChange.initiatorAccount),
    nextOwnerAccount: buildActorSummary(ownershipChange.nextOwnerAccount),
    video: ownershipChange.video
      ? buildVideoSummary(ownershipChange.video)
      : null,
    videoChannel: ownershipChange.videoChannel
      ? buildChannelSummary(ownershipChange.videoChannel)
      : null,
    createdAt: ownershipChange.createdAt
  })
}

export function buildCommentAuditEntity (comment: VideoComment, video: VideoSummary) {
  return buildEntity(AuditLogEntityType.COMMENT, comment.id, {
    id: comment.id,
    url: comment.url,
    text: comment.text,
    threadId: comment.threadId,
    inReplyToCommentId: comment.inReplyToCommentId,
    videoId: comment.videoId,
    video: buildVideoSummary(video),
    heldForReview: comment.heldForReview,
    createdAt: comment.createdAt,
    account: buildActorSummary(comment.account)
  })
}

// ---------------------------------------------------------------------------
// Channels and playlists
// ---------------------------------------------------------------------------

export function buildChannelAuditEntity (channel: VideoChannel) {
  return buildEntity(AuditLogEntityType.CHANNEL, channel.id, {
    id: channel.id,
    name: channel.name,
    displayName: channel.displayName,
    description: channel.description,
    support: channel.support,
    publicEmail: channel.publicEmail ?? null,
    url: channel.url,
    isLocal: channel.isLocal,
    avatars: buildActorImages(channel.avatars),
    banners: buildActorImages(channel.banners),
    createdAt: channel.createdAt,
    ownerAccount: channel.ownerAccount
      ? buildActorSummary(channel.ownerAccount)
      : null
  })
}

export function buildChannelSyncAuditEntity (channelSync: VideoChannelSync) {
  return buildEntity(AuditLogEntityType.CHANNEL_SYNC, channelSync.id, {
    id: channelSync.id,
    externalChannelUrl: channelSync.externalChannelUrl,
    videoPrivacy: channelSync.videoPrivacy,
    createdAt: channelSync.createdAt,
    channel: buildActorSummary(channelSync.channel)
  })
}

export function buildChannelVideosImportAuditEntity (options: {
  channel: ChannelSummary
  externalChannelUrl: string
  videoChannelSyncId: number | null
}) {
  return buildEntity(AuditLogEntityType.CHANNEL_VIDEOS_IMPORT, options.channel.id, {
    channel: buildChannelSummary(options.channel),
    externalChannelUrl: options.externalChannelUrl,
    videoChannelSyncId: options.videoChannelSyncId
  })
}

export function buildChannelCollaboratorAuditEntity (options: {
  channel: ChannelSummary
  collaborator: VideoChannelCollaborator
}) {
  const { channel, collaborator } = options

  return buildEntity(AuditLogEntityType.CHANNEL_COLLABORATOR, collaborator.id, {
    id: collaborator.id,
    state: collaborator.state,
    channel: buildChannelSummary(channel),
    account: buildActorSummary(collaborator.account)
  })
}

export function buildChannelPlayerSettingsAuditEntity (options: {
  channel: ChannelSummary
  theme: string | null
}) {
  return buildEntity(AuditLogEntityType.CHANNEL_PLAYER_SETTINGS, options.channel.id, {
    channel: buildChannelSummary(options.channel),
    theme: options.theme
  })
}

// Reorder playlists of a channel
// Record an update of the position: old entity with the start position, new entity with the "insert after" position
export function buildChannelPlaylistsOrderAuditEntity (options: {
  channel: ChannelSummary
  position: number
  reorderLength: number
}) {
  return buildEntity(AuditLogEntityType.CHANNEL_PLAYLISTS_ORDER, options.channel.id, {
    channel: buildChannelSummary(options.channel),
    position: options.position,
    reorderLength: options.reorderLength
  })
}

export function buildPlaylistAuditEntity (playlist: {
  id: number
  uuid: string
  name: string
  description: string
  privacy: number
  type: number
  videoChannelId: number
  ownerAccountId: number
}) {
  return buildEntity(AuditLogEntityType.PLAYLIST, playlist.id, {
    id: playlist.id,
    uuid: playlist.uuid,
    displayName: playlist.name,
    description: playlist.description,
    privacy: playlist.privacy,
    type: playlist.type,
    videoChannelId: playlist.videoChannelId,
    ownerAccountId: playlist.ownerAccountId
  })
}

export function buildPlaylistElementAuditEntity (options: {
  playlist: { id: number, uuid: string }
  element: { id: number, position: number, startTimestamp: number, stopTimestamp: number, videoId: number }
}) {
  const { playlist, element } = options

  return buildEntity(AuditLogEntityType.PLAYLIST_ELEMENT, element.id, {
    id: element.id,
    playlist: { id: playlist.id, uuid: playlist.uuid },
    videoId: element.videoId,
    position: element.position,
    startTimestamp: element.startTimestamp,
    stopTimestamp: element.stopTimestamp
  })
}

// Reorder elements of a playlist
// Record an update of the position: old entity with the start position, new entity with the "insert after" position
export function buildPlaylistElementsOrderAuditEntity (options: {
  playlist: { id: number, uuid: string }
  position: number
  reorderLength: number
}) {
  return buildEntity(AuditLogEntityType.PLAYLIST_ELEMENTS_ORDER, options.playlist.id, {
    playlist: { id: options.playlist.id, uuid: options.playlist.uuid },
    position: options.position,
    reorderLength: options.reorderLength
  })
}

// ---------------------------------------------------------------------------
// Users and account security
// ---------------------------------------------------------------------------

export function buildUserAuditEntity (userModel: MUserFormattable) {
  const user = userModel.toFormattedJSON({ withAdminFlags: true })

  return buildEntity(AuditLogEntityType.USER, user.id, {
    id: user.id,
    username: user.username,
    email: user.email,
    pendingEmail: user.pendingEmail,
    emailVerified: user.emailVerified,
    role: user.role,
    adminFlags: user.adminFlags,
    videoQuota: user.videoQuota,
    videoQuotaDaily: user.videoQuotaDaily,
    blocked: user.blocked,
    blockedReason: user.blockedReason ?? null,
    pluginAuth: user.pluginAuth,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt,
    account: {
      ...buildActorSummary(user.account),

      description: user.account.description,
      avatars: buildActorImages(user.account.avatars)
    }
  })
}

export function buildRegistrationAuditEntity (registration: {
  id: number
  state: number
  username: string
  email: string
  emailVerified: boolean
  registrationReason: string
  moderationResponse: string
  accountDisplayName: string
  channelHandle: string
  channelDisplayName: string
  userId: number
}) {
  return buildEntity(AuditLogEntityType.REGISTRATION, registration.id, {
    id: registration.id,
    state: registration.state,
    username: registration.username,
    email: registration.email,
    emailVerified: registration.emailVerified,
    registrationReason: registration.registrationReason,
    moderationResponse: registration.moderationResponse,
    accountDisplayName: registration.accountDisplayName,
    channelHandle: registration.channelHandle,
    channelDisplayName: registration.channelDisplayName,
    userId: registration.userId
  })
}

export function buildPasswordResetAuditEntity (user: UserSummary) {
  return buildEntity(AuditLogEntityType.PASSWORD_RESET, user.id, {
    user: buildUserSummary(user)
  })
}

export function buildTokenSessionAuditEntity (options: {
  user: UserSummary

  // Unknown when a token is created
  tokenSessionId: number | null

  authName?: string | null
  loginDevice?: string | null
}) {
  return buildEntity(AuditLogEntityType.TOKEN_SESSION, options.tokenSessionId, {
    user: buildUserSummary(options.user),
    authName: options.authName ?? null,
    loginDevice: options.loginDevice ?? null
  })
}

export function buildFailedLoginAuditEntity (options: {
  username: string
  error: string
}) {
  return buildEntity(AuditLogEntityType.FAILED_LOGIN, null, {
    username: typeof options.username === 'string'
      ? options.username.substring(0, 255)
      : null,
    error: options.error
  })
}

// Scoped tokens (feed token...) are secrets: never store them
export function buildScopedTokenAuditEntity (user: UserSummary) {
  return buildEntity(AuditLogEntityType.SCOPED_TOKEN, user.id, {
    user: buildUserSummary(user)
  })
}

export function buildUserExportAuditEntity (options: {
  user: UserSummary
  userExport: { id: number, withVideoFiles: boolean }
}) {
  return buildEntity(AuditLogEntityType.USER_EXPORT, options.userExport.id, {
    id: options.userExport.id,
    user: buildUserSummary(options.user),
    withVideoFiles: options.userExport.withVideoFiles
  })
}

export function buildUserImportAuditEntity (options: {
  user: UserSummary
  userImport: IdSummary
}) {
  return buildEntity(AuditLogEntityType.USER_IMPORT, options.userImport.id, {
    id: options.userImport.id,
    user: buildUserSummary(options.user)
  })
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

// Built from the model: the formatted JSON needs associations that are not always loaded
export function buildAbuseAuditEntity (abuse: MAbuseFull) {
  const video = abuse.VideoAbuse?.Video
  const comment = abuse.VideoCommentAbuse?.VideoComment

  return buildEntity(AuditLogEntityType.ABUSE, abuse.id, {
    id: abuse.id,
    reason: abuse.reason,
    predefinedReasons: abuse.predefinedReasons ?? [],
    state: abuse.state,
    moderationComment: abuse.moderationComment ?? null,
    reporterAccount: abuse.ReporterAccount
      ? buildAccountModelSummary(abuse.ReporterAccount)
      : null,
    flaggedAccount: abuse.FlaggedAccount
      ? buildAccountModelSummary(abuse.FlaggedAccount)
      : null,
    video: video
      ? { ...buildVideoSummary(video), startAt: abuse.VideoAbuse.startAt, endAt: abuse.VideoAbuse.endAt }
      : null,
    comment: comment
      ? { id: comment.id, text: comment.text, video: comment.Video ? buildVideoSummary(comment.Video) : null }
      : null,
    createdAt: abuse.createdAt
  })
}

export function buildAbuseMessageAuditEntity (abuseMessage: {
  id: number
  abuseId: number
  accountId: number
  message: string
  byModerator: boolean
}) {
  return buildEntity(AuditLogEntityType.ABUSE_MESSAGE, abuseMessage.id, {
    id: abuseMessage.id,
    abuseId: abuseMessage.abuseId,
    accountId: abuseMessage.accountId,
    message: abuseMessage.message,
    byModerator: abuseMessage.byModerator
  })
}

export function buildVideoBlockAuditEntity (options: {
  video: VideoSummary
  videoBlock: {
    id: number
    reason: string
    internalNote: string
    unfederated: boolean
    type: number
  }
}) {
  const { video, videoBlock } = options

  return buildEntity(AuditLogEntityType.VIDEO_BLOCK, videoBlock.id, {
    id: videoBlock.id,
    video: buildVideoSummary(video),
    reason: videoBlock.reason,
    internalNote: videoBlock.internalNote,
    unfederated: videoBlock.unfederated,
    type: videoBlock.type
  })
}

// The entity id is the id of the blocked account, to get the block history of an account
export function buildAccountBlockAuditEntity (options: {
  byAccountId: number
  targetAccount: { id: number, handle: string }
}) {
  return buildEntity(AuditLogEntityType.ACCOUNT_BLOCK, options.targetAccount.id, {
    byAccountId: options.byAccountId,
    targetAccount: { id: options.targetAccount.id, handle: options.targetAccount.handle }
  })
}

// The entity id is the id of the blocked server, to get the block history of a server
export function buildServerBlockAuditEntity (options: {
  byAccountId: number
  targetServer: { id: number, host: string }
}) {
  return buildEntity(AuditLogEntityType.SERVER_BLOCK, options.targetServer.id, {
    byAccountId: options.byAccountId,
    targetServer: { id: options.targetServer.id, host: options.targetServer.host }
  })
}

export function buildBlocklistSubscriptionAuditEntity (subscription: { id: number, name: string, url: string }) {
  return buildEntity(AuditLogEntityType.BLOCKLIST_SUBSCRIPTION, subscription.id, {
    id: subscription.id,
    name: subscription.name,
    url: subscription.url
  })
}

export function buildWatchedWordsListAuditEntity (list: {
  id: number
  accountId: number
  listName: string
  words: string[]
}) {
  return buildEntity(AuditLogEntityType.WATCHED_WORDS_LIST, list.id, {
    id: list.id,
    accountId: list.accountId,
    listName: list.listName,
    words: list.words
  })
}

export function buildWatchedWordsSubscriptionAuditEntity (subscription: {
  id: number
  accountId: number
  name: string
  url: string
}) {
  return buildEntity(AuditLogEntityType.WATCHED_WORDS_SUBSCRIPTION, subscription.id, {
    id: subscription.id,
    accountId: subscription.accountId,
    name: subscription.name,
    url: subscription.url
  })
}

export function buildAutomaticTagPolicyAuditEntity (options: {
  accountId: number
  policy: number
  tags: string[]
}) {
  return buildEntity(AuditLogEntityType.AUTOMATIC_TAG_POLICY, options.accountId, {
    accountId: options.accountId,
    policy: options.policy,
    tags: [ ...options.tags ].sort()
  })
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export function buildConfigAuditEntity (config: CustomConfig) {
  // The custom config doesn't contain secrets, so keep all of it to know exactly what changed
  return buildEntity(AuditLogEntityType.CONFIG, null, config)
}

export function buildInstanceImageAuditEntity (type: string) {
  return buildEntity(AuditLogEntityType.INSTANCE_IMAGE, null, { type })
}

export function buildInstanceHomepageAuditEntity (content: string) {
  return buildEntity(AuditLogEntityType.INSTANCE_HOMEPAGE, null, { content: content ?? null })
}

export function buildInstanceHostAuditEntity (host: string) {
  return buildEntity(AuditLogEntityType.INSTANCE_HOST, null, { host })
}

export function buildPluginAuditEntity (options: {
  plugin: { id?: number, name: string, type: number, version?: string }
  npmName: string

  settings?: Record<string, any>
  registeredSettings?: RegisterServerSettingOptions[]
}) {
  const { plugin, npmName, settings, registeredSettings = [] } = options

  return buildEntity(AuditLogEntityType.PLUGIN, plugin.id ?? null, {
    npmName,
    name: plugin.name,
    type: plugin.type,
    version: plugin.version ?? null,
    settings: settings
      ? hidePluginSecretSettings(settings, registeredSettings)
      : undefined
  })
}

export function buildFollowAuditEntity (options: {
  // Unknown when the follow is created asynchronously
  id: number | null
  follower: string
  following: string
  state: string
}) {
  return buildEntity(AuditLogEntityType.FOLLOW, options.id, {
    id: options.id,
    follower: options.follower,
    following: options.following,
    state: options.state
  })
}

export function buildServerRedundancyAuditEntity (server: { id: number, host: string, redundancyAllowed: boolean }) {
  return buildEntity(AuditLogEntityType.SERVER_REDUNDANCY, server.id, {
    host: server.host,
    redundancyAllowed: server.redundancyAllowed
  })
}

export function buildVideoRedundancyAuditEntity (options: {
  video: VideoSummary

  // Unknown when the redundancy is created asynchronously
  redundancy: { id: number, url: string, strategy: string } | null
}) {
  const { video, redundancy } = options

  return buildEntity(AuditLogEntityType.VIDEO_REDUNDANCY, redundancy?.id ?? null, {
    video: buildVideoSummary(video),
    url: redundancy?.url ?? null,
    strategy: redundancy?.strategy ?? null
  })
}

export function buildJobQueueAuditEntity (options: {
  paused: boolean
  processRoles: string[]
}) {
  return buildEntity(AuditLogEntityType.JOB_QUEUE, null, {
    paused: options.paused,
    processRoles: options.processRoles ?? null
  })
}

// Don't store job data: it can contain private information (emails...)
export function buildJobAuditEntity (job: { id: string, type: string }) {
  return buildEntity(AuditLogEntityType.JOB, null, {
    id: job.id,
    type: job.type
  })
}

export function buildRunnerAuditEntity (runner: { id: number, name: string, description: string, version: string, ip: string }) {
  return buildEntity(AuditLogEntityType.RUNNER, runner.id, {
    id: runner.id,
    name: runner.name,
    description: runner.description,
    version: runner.version,
    ip: runner.ip
  })
}

// The registration token is a secret: never store it
export function buildRunnerRegistrationTokenAuditEntity (registrationToken: IdSummary) {
  return buildEntity(AuditLogEntityType.RUNNER_REGISTRATION_TOKEN, registrationToken.id, {
    id: registrationToken.id
  })
}

export function buildDebugCommandAuditEntity (command: string) {
  return buildEntity(AuditLogEntityType.DEBUG_COMMAND, null, { command })
}

export function buildStoragePruneAuditEntity (options: {
  storage: 'file-system' | 'object-storage'
  deletedFiles: number
}) {
  return buildEntity(AuditLogEntityType.STORAGE_PRUNE, null, {
    storage: options.storage,
    deletedFiles: options.deletedFiles
  })
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export function buildChannelAuditSummary (channel: MChannelId & { Actor: Pick<MActor, 'preferredUsername'> }): ChannelSummary {
  return { id: channel.id, name: channel.Actor.preferredUsername }
}

// ---------------------------------------------------------------------------
// Private
// ---------------------------------------------------------------------------

function buildEntity (type: AuditLogEntityTypeType, id: number | null, data: object): AuditLogEntity {
  return {
    type,
    id,

    // Normalize data to compare old and new entities
    data: JSON.parse(JSON.stringify(data))
  }
}

function buildActorSummary (actor: Account | AccountSummary | VideoChannelSummary | VideoChannel) {
  return {
    id: actor.id,
    name: actor.name,
    displayName: actor.displayName,
    host: actor.host
  }
}

function buildAccountModelSummary (account: MAccountLight) {
  return {
    id: account.id,
    name: account.Actor.preferredUsername,
    displayName: account.name,
    host: account.Actor.getHost()
  }
}

function buildVideoSummary (video: VideoSummary) {
  return { id: video.id, uuid: video.uuid, name: video.name }
}

function buildChannelSummary (channel: ChannelSummary) {
  return { id: channel.id, name: channel.name }
}

function buildUserSummary (user: UserSummary) {
  return { id: user.id, username: user.username }
}

function buildActorImages (images: ActorImage[]) {
  return (images || []).map(i => ({ width: i.width, fileUrl: i.fileUrl }))
}

function hidePluginSecretSettings (settings: Record<string, any>, registeredSettings: RegisterServerSettingOptions[]) {
  const publicSettings = new Set(
    registeredSettings
      .filter(s => s.private === false && s.type !== 'input-password')
      .map(s => s.name)
  )

  return Object.fromEntries(
    Object.entries(settings).map(([ key, value ]) => {
      if (publicSettings.has(key) || value === null || value === undefined || value === '') return [ key, value ]

      const fingerprint = createHmac('sha256', CONFIG.SECRETS.PEERTUBE).update(JSON.stringify(value)).digest('hex').substring(0, 12)

      return [ key, `[hidden:${fingerprint}]` ]
    })
  )
}
