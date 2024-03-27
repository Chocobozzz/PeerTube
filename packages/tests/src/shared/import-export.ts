/* eslint-disable @typescript-eslint/no-unused-expressions */
import {
  ActivityCreate,
  ActivityPubOrderedCollection,
  HttpStatusCode,
  LiveVideoLatencyMode,
  UserExport,
  UserNotificationSettingValue,
  VideoCommentObject,
  VideoObject,
  VideoPlaylistPrivacy,
  VideoPrivacy
} from '@peertube/peertube-models'
import {
  ConfigCommand,
  ObjectStorageCommand,
  PeerTubeServer,
  createSingleServer,
  doubleFollow, makeRawRequest,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expect } from 'chai'
import JSZip from 'jszip'
import { resolve } from 'path'
import { MockSmtpServer } from './mock-servers/mock-email.js'
import { getAllNotificationsSettings } from './notifications.js'
import { getFilenameFromUrl } from '@peertube/peertube-node-utils'
import { testFileExistsOnFSOrNot } from './checks.js'

type ExportOutbox = ActivityPubOrderedCollection<ActivityCreate<VideoObject | VideoCommentObject>>

export async function downloadZIP (server: PeerTubeServer, userId: number) {
  const { data } = await server.userExports.list({ userId })

  const res = await makeRawRequest({
    url: data[0].privateDownloadUrl,
    responseType: 'arraybuffer',
    redirects: 1,
    expectedStatus: HttpStatusCode.OK_200
  })

  return JSZip.loadAsync(res.body)
}

export async function parseZIPJSONFile <T> (zip: JSZip, path: string) {
  return JSON.parse(await zip.file(path).async('string')) as T
}

export async function checkFileExistsInZIP (zip: JSZip, path: string, base = '/') {
  const innerPath = resolve(base, path).substring(1) // Remove '/' at the beginning of the string

  expect(zip.files[innerPath], `${innerPath} does not exist`).to.exist

  const buf = await zip.file(innerPath).async('arraybuffer')
  expect(buf.byteLength, `${innerPath} is empty`).to.be.greaterThan(0)
}

// ---------------------------------------------------------------------------

export function parseAPOutbox (zip: JSZip) {
  return parseZIPJSONFile<ExportOutbox>(zip, 'activity-pub/outbox.json')
}

export function findVideoObjectInOutbox (outbox: ExportOutbox, videoName: string) {
  return outbox.orderedItems.find(i => {
    return i.type === 'Create' && i.object.type === 'Video' && i.object.name === videoName
  }) as ActivityCreate<VideoObject>
}

// ---------------------------------------------------------------------------

export async function regenerateExport (options: {
  server: PeerTubeServer
  userId: number
  withVideoFiles: boolean
}) {
  const { server, userId, withVideoFiles } = options

  await server.userExports.deleteAllArchives({ userId })
  const res = await server.userExports.request({ userId, withVideoFiles })
  await server.userExports.waitForCreation({ userId })

  return res
}

export async function checkExportFileExists (options: {
  server: PeerTubeServer
  userExport: UserExport
  redirectedUrl: string
  exists: boolean
  withObjectStorage: boolean
}) {
  const { server, exists, userExport, redirectedUrl, withObjectStorage } = options

  const filename = getFilenameFromUrl(userExport.privateDownloadUrl)

  if (exists === true) {
    if (withObjectStorage) {
      return makeRawRequest({ url: redirectedUrl, expectedStatus: HttpStatusCode.OK_200 })
    }

    return testFileExistsOnFSOrNot(server, 'tmp-persistent', filename, true)
  }

  await testFileExistsOnFSOrNot(server, 'tmp-persistent', filename, false)

  if (withObjectStorage) {
    await makeRawRequest({ url: redirectedUrl, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
  }
}

export async function prepareImportExportTests (options: {
  objectStorage: ObjectStorageCommand
  emails: object[]
  withBlockedServer: boolean
}) {
  const { emails, objectStorage, withBlockedServer } = options

  let objectStorageConfig: any = {}
  if (objectStorage) {
    await objectStorage.prepareDefaultMockBuckets()

    objectStorageConfig = objectStorage.getDefaultMockConfig()
  }

  const emailPort = await MockSmtpServer.Instance.collectEmails(emails)

  const overrideConfig = {
    ...objectStorageConfig,
    ...ConfigCommand.getEmailOverrideConfig(emailPort),
    ...ConfigCommand.getDisableRatesLimitOverrideConfig()
  }

  const [ server, remoteServer, blockedServer ] = await Promise.all([
    createSingleServer(1, overrideConfig),
    createSingleServer(2, overrideConfig),

    withBlockedServer
      ? createSingleServer(3)
      : Promise.resolve(undefined)
  ])

  const servers = [ server, remoteServer, blockedServer ].filter(s => !!s)

  await setAccessTokensToServers(servers)
  await setDefaultVideoChannel(servers)

  await remoteServer.config.enableMinimumTranscoding()

  await Promise.all([
    doubleFollow(server, remoteServer),

    withBlockedServer
      ? doubleFollow(server, blockedServer)
      : Promise.resolve(undefined),

    withBlockedServer
      ? doubleFollow(remoteServer, blockedServer)
      : Promise.resolve(undefined)
  ])

  const mouskaToken = await server.users.generateUserAndToken('mouska')
  const noahToken = await server.users.generateUserAndToken('noah')
  const remoteNoahToken = await remoteServer.users.generateUserAndToken('noah_remote')

  // Channel
  const { id: noahSecondChannelId } = await server.channels.create({
    token: noahToken,
    attributes: {
      name: 'noah_second_channel',
      displayName: 'noah display name',
      description: 'noah description',
      support: 'noah support'
    }
  })

  await server.channels.updateImage({
    channelName: 'noah_second_channel',
    fixture: 'banner.jpg',
    type: 'banner'
  })

  await server.channels.updateImage({
    channelName: 'noah_second_channel',
    fixture: 'avatar.png',
    type: 'avatar'
  })

  // Videos
  const externalVideo = await remoteServer.videos.quickUpload({ name: 'external video', privacy: VideoPrivacy.PUBLIC })

  // eslint-disable-next-line max-len
  const noahPrivateVideo = await server.videos.quickUpload({ name: 'noah private video', token: noahToken, privacy: VideoPrivacy.PRIVATE })
  const noahVideo = await server.videos.quickUpload({ name: 'noah public video', token: noahToken, privacy: VideoPrivacy.PUBLIC })
  // eslint-disable-next-line max-len
  await server.videos.upload({
    token: noahToken,
    attributes: {
      fixture: 'video_short.webm',
      name: 'noah public video second channel',
      category: 12,
      tags: [ 'tag1', 'tag2' ],
      commentsEnabled: false,
      description: 'video description',
      downloadEnabled: false,
      language: 'fr',
      licence: 1,
      nsfw: false,
      originallyPublishedAt: new Date(0).toISOString(),
      support: 'video support',
      waitTranscoding: true,
      channelId: noahSecondChannelId,
      privacy: VideoPrivacy.PUBLIC,
      thumbnailfile: 'custom-thumbnail.jpg',
      previewfile: 'custom-preview.jpg'
    }
  })

  await server.videos.quickUpload({ name: 'mouska private video', token: mouskaToken, privacy: VideoPrivacy.PRIVATE })
  const mouskaVideo = await server.videos.quickUpload({ name: 'mouska public video', token: mouskaToken, privacy: VideoPrivacy.PUBLIC })

  // Captions
  await server.captions.add({ language: 'ar', videoId: noahVideo.uuid, fixture: 'subtitle-good1.vtt' })
  await server.captions.add({ language: 'fr', videoId: noahVideo.uuid, fixture: 'subtitle-good1.vtt' })

  // Chapters
  await server.chapters.update({
    videoId: noahVideo.uuid,
    chapters: [
      { timecode: 1, title: 'chapter 1' },
      { timecode: 3, title: 'chapter 2' }
    ]
  })

  // My settings
  await server.users.updateMe({ token: noahToken, description: 'super noah description', p2pEnabled: false })

  // My notification settings
  await server.notifications.updateMySettings({
    token: noahToken,

    settings: {
      ...getAllNotificationsSettings(),

      myVideoPublished: UserNotificationSettingValue.NONE,
      commentMention: UserNotificationSettingValue.EMAIL
    }
  })

  // Rate
  await waitJobs([ server, remoteServer ])

  await server.videos.rate({ id: mouskaVideo.uuid, token: noahToken, rating: 'like' })
  await server.videos.rate({ id: noahVideo.uuid, token: noahToken, rating: 'like' })
  await server.videos.rate({ id: externalVideo.uuid, token: noahToken, rating: 'dislike' })

  await server.videos.rate({ id: noahVideo.uuid, token: mouskaToken, rating: 'like' })

  // 2 followers
  await remoteServer.subscriptions.add({ targetUri: 'noah_channel@' + server.host })
  await server.subscriptions.add({ targetUri: 'noah_channel@' + server.host })

  // 2 following
  await server.subscriptions.add({ token: noahToken, targetUri: 'mouska_channel@' + server.host })
  await server.subscriptions.add({ token: noahToken, targetUri: 'root_channel@' + remoteServer.host })

  // 2 playlists
  await server.playlists.quickCreate({ displayName: 'root playlist' })
  const noahPlaylist = await server.playlists.quickCreate({ displayName: 'noah playlist 1', token: noahToken })
  await server.playlists.quickCreate({ displayName: 'noah playlist 2', token: noahToken, privacy: VideoPlaylistPrivacy.PRIVATE })

  // eslint-disable-next-line max-len
  await server.playlists.addElement({ playlistId: noahPlaylist.uuid, token: noahToken, attributes: { videoId: mouskaVideo.uuid, startTimestamp: 2, stopTimestamp: 3 } })
  await server.playlists.addElement({ playlistId: noahPlaylist.uuid, token: noahToken, attributes: { videoId: noahVideo.uuid } })
  await server.playlists.addElement({ playlistId: noahPlaylist.uuid, token: noahToken, attributes: { videoId: noahPrivateVideo.uuid } })

  // 3 threads and some replies
  await remoteServer.comments.createThread({ videoId: noahVideo.uuid, text: 'remote comment' })
  await waitJobs([ server, remoteServer ])

  await server.comments.createThread({ videoId: noahVideo.uuid, text: 'local comment' })
  await server.comments.addReplyToLastThread({ token: noahToken, text: 'noah reply' })

  await server.comments.createThread({ videoId: mouskaVideo.uuid, token: noahToken, text: 'noah comment' })

  // Fetch user ids
  const rootId = (await server.users.getMyInfo()).id
  const noahId = (await server.users.getMyInfo({ token: noahToken })).id
  const remoteRootId = (await remoteServer.users.getMyInfo()).id
  const remoteNoahId = (await remoteServer.users.getMyInfo({ token: remoteNoahToken })).id

  // Lives
  await server.config.enableMinimumTranscoding()
  await server.config.enableLive({ allowReplay: true })

  const noahLive = await server.live.create({
    fields: {
      permanentLive: true,
      saveReplay: true,
      latencyMode: LiveVideoLatencyMode.SMALL_LATENCY,
      replaySettings: {
        privacy: VideoPrivacy.PUBLIC
      },
      videoPasswords: [ 'password1' ],
      channelId: noahSecondChannelId,
      name: 'noah live video',
      privacy: VideoPrivacy.PASSWORD_PROTECTED
    },
    token: noahToken
  })

  // Views
  await server.views.view({ id: noahVideo.uuid, token: noahToken, currentTime: 4 })
  await server.views.view({ id: externalVideo.uuid, token: noahToken, currentTime: 2 })

  return {
    rootId,

    mouskaToken,
    mouskaVideo,

    remoteRootId,
    remoteNoahId,
    remoteNoahToken,

    externalVideo,

    noahId,
    noahToken,
    noahPlaylist,
    noahPrivateVideo,
    noahVideo,
    noahLive,

    server,
    remoteServer,
    blockedServer
  }
}
