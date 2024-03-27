/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import {
  HttpStatusCode,
  LiveVideoLatencyMode,
  UserImportState,
  UserNotificationSettingValue,
  VideoCreateResult,
  VideoPlaylistPrivacy,
  VideoPlaylistType,
  VideoPrivacy,
  VideoState
} from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  ObjectStorageCommand,
  PeerTubeServer,
  cleanupTests,
  waitJobs
} from '@peertube/peertube-server-commands'
import { testAvatarSize, testImage } from '@tests/shared/checks.js'
import { prepareImportExportTests } from '@tests/shared/import-export.js'
import { MockSmtpServer } from '@tests/shared/mock-servers/index.js'
import { completeCheckHlsPlaylist } from '@tests/shared/streaming-playlists.js'
import { completeVideoCheck } from '@tests/shared/videos.js'
import { expect } from 'chai'
import { join } from 'path'

function runTest (withObjectStorage: boolean) {
  let server: PeerTubeServer
  let remoteServer: PeerTubeServer
  let blockedServer: PeerTubeServer

  let noahToken: string

  let noahId: number

  const emails: object[] = []

  let externalVideo: VideoCreateResult
  let noahVideo: VideoCreateResult
  let mouskaVideo: VideoCreateResult

  let remoteNoahToken: string
  let remoteNoahId: number

  let archivePath: string

  let objectStorage: ObjectStorageCommand

  let latestImportId: number

  before(async function () {
    this.timeout(240000)

    objectStorage = withObjectStorage
      ? new ObjectStorageCommand()
      : undefined;

    ({
      noahId,
      externalVideo,
      noahVideo,
      noahToken,
      server,
      remoteNoahId,
      remoteNoahToken,
      remoteServer,
      mouskaVideo,
      blockedServer
    } = await prepareImportExportTests({ emails, objectStorage, withBlockedServer: true }))

    await blockedServer.videos.quickUpload({ name: 'blocked video' })
    await waitJobs([ blockedServer ])

    // Also add some blocks
    const blocks = [
      { account: 'mouska' },
      { account: 'root@' + blockedServer.host },
      { server: blockedServer.host }
    ]

    for (const toBlock of blocks) {
      await server.blocklist.addToMyBlocklist({ token: noahToken, ...toBlock })
    }

    // Add avatars
    await server.users.updateMyAvatar({ token: noahToken, fixture: 'avatar.png' })

    // Add password protected video
    await server.videos.upload({
      token: noahToken,
      attributes: {
        name: 'noah password video',
        privacy: VideoPrivacy.PASSWORD_PROTECTED,
        videoPasswords: [ 'password1', 'password2' ]
      }
    })

    // Add a video in watch later playlist
    await server.playlists.addElement({
      playlistId: (await server.playlists.getWatchLater({ token: noahToken, handle: 'noah' })).id,
      attributes: { videoId: noahVideo.uuid }
    })

    await remoteServer.playlists.addElement({
      playlistId: (await remoteServer.playlists.getWatchLater({ token: remoteNoahToken, handle: 'noah_remote' })).id,
      attributes: { videoId: mouskaVideo.uuid }
    })

    await waitJobs([ server, remoteServer, blockedServer ])

    // ---------------------------------------------------------------------------

    await server.userExports.request({ userId: noahId, withVideoFiles: true })
    await server.userExports.waitForCreation({ userId: noahId })

    archivePath = join(server.getDirectoryPath('tmp'), 'archive.zip')
    await server.userExports.downloadLatestArchive({ userId: noahId, destination: archivePath })
  })

  it('Should import an archive with video files', async function () {
    this.timeout(240000)

    const { userImport } = await remoteServer.userImports.importArchive({ fixture: archivePath, userId: remoteNoahId })
    latestImportId = userImport.id

    await waitJobs([ server, remoteServer ])
  })

  it('Should have a valid import status', async function () {
    const userImport = await remoteServer.userImports.getLatestImport({ userId: remoteNoahId, token: remoteNoahToken })

    expect(userImport.id).to.equal(latestImportId)
    expect(userImport.state.id).to.equal(UserImportState.COMPLETED)
    expect(userImport.state.label).to.equal('Completed')
  })

  it('Should have correctly imported blocklist', async function () {
    {
      const { data } = await remoteServer.blocklist.listMyAccountBlocklist({ start: 0, count: 5, token: remoteNoahToken })

      expect(data).to.have.lengthOf(2)
      expect(data.find(a => a.blockedAccount.host === server.host && a.blockedAccount.name === 'mouska')).to.exist
      expect(data.find(a => a.blockedAccount.host === blockedServer.host && a.blockedAccount.name === 'root')).to.exist
    }

    {
      const { data } = await remoteServer.blocklist.listMyServerBlocklist({ start: 0, count: 5, token: remoteNoahToken })

      expect(data).to.have.lengthOf(1)
      expect(data.find(a => a.blockedServer.host === blockedServer.host)).to.exist
    }
  })

  it('Should have correctly imported account', async function () {
    const me = await remoteServer.users.getMyInfo({ token: remoteNoahToken })

    expect(me.account.displayName).to.equal('noah')
    expect(me.username).to.equal('noah_remote')
    expect(me.account.description).to.equal('super noah description')
    expect(me.account.avatars).to.have.lengthOf(4)

    for (const avatar of me.account.avatars) {
      await testAvatarSize({ url: remoteServer.url, avatar, imageName: `avatar-resized-${avatar.width}x${avatar.width}` })
    }
  })

  it('Should have correctly imported user settings', async function () {
    {
      const me = await remoteServer.users.getMyInfo({ token: remoteNoahToken })

      expect(me.p2pEnabled).to.be.false

      const settings = me.notificationSettings

      expect(settings.newVideoFromSubscription).to.equal(UserNotificationSettingValue.WEB | UserNotificationSettingValue.EMAIL)
      expect(settings.myVideoPublished).to.equal(UserNotificationSettingValue.NONE)
      expect(settings.commentMention).to.equal(UserNotificationSettingValue.EMAIL)
    }
  })

  it('Should have correctly imported channels', async function () {
    const { data: channels } = await remoteServer.channels.listByAccount({ token: remoteNoahToken, accountName: 'noah_remote' })

    // One default + 2 imported
    expect(channels).to.have.lengthOf(3)

    await remoteServer.channels.get({ token: remoteNoahToken, channelName: 'noah_remote_channel' })

    const importedMain = await remoteServer.channels.get({ token: remoteNoahToken, channelName: 'noah_channel' })
    expect(importedMain.displayName).to.equal('Main noah channel')
    expect(importedMain.avatars).to.have.lengthOf(0)
    expect(importedMain.banners).to.have.lengthOf(0)

    const importedSecond = await remoteServer.channels.get({ token: remoteNoahToken, channelName: 'noah_second_channel' })
    expect(importedSecond.displayName).to.equal('noah display name')
    expect(importedSecond.description).to.equal('noah description')
    expect(importedSecond.support).to.equal('noah support')

    for (const banner of importedSecond.banners) {
      await testImage(remoteServer.url, `banner-user-import-resized-${banner.width}`, banner.path)
    }

    for (const avatar of importedSecond.avatars) {
      await testImage(remoteServer.url, `avatar-resized-${avatar.width}x${avatar.width}`, avatar.path, '.png')
    }

    {
      // Also check the correct count on origin server
      const { data: channels } = await server.channels.listByAccount({ accountName: 'noah_remote@' + remoteServer.host })
      expect(channels).to.have.lengthOf(2) // noah_remote_channel doesn't have videos so it has not been federated
    }
  })

  it('Should have correctly imported following', async function () {
    const { data } = await remoteServer.subscriptions.list({ token: remoteNoahToken })

    expect(data).to.have.lengthOf(2)
    expect(data.find(f => f.name === 'mouska_channel' && f.host === server.host)).to.exist
    expect(data.find(f => f.name === 'root_channel' && f.host === remoteServer.host)).to.exist
  })

  it('Should not have reimported followers (it is not a migration)', async function () {
    for (const checkServer of [ server, remoteServer ]) {
      const { data } = await checkServer.channels.listFollowers({ channelName: 'noah_channel@' + remoteServer.host })

      expect(data).to.have.lengthOf(0)
    }
  })

  it('Should not have imported comments (it is not a migration)', async function () {
    for (const checkServer of [ server, remoteServer ]) {
      {
        const threads = await checkServer.comments.listThreads({ videoId: noahVideo.uuid })
        expect(threads.total).to.equal(2)
      }

      {
        const threads = await checkServer.comments.listThreads({ videoId: mouskaVideo.uuid })
        expect(threads.total).to.equal(1)
      }
    }
  })

  it('Should have correctly imported likes/dislikes', async function () {
    {
      const { rating } = await remoteServer.users.getMyRating({ videoId: mouskaVideo.uuid, token: remoteNoahToken })
      expect(rating).to.equal('like')

      for (const checkServer of [ server, remoteServer ]) {
        const video = await checkServer.videos.get({ id: mouskaVideo.uuid })
        expect(video.likes).to.equal(2) // Old account + new account rates
        expect(video.dislikes).to.equal(0)
      }
    }

    {
      const { rating } = await remoteServer.users.getMyRating({ videoId: noahVideo.uuid, token: remoteNoahToken })
      expect(rating).to.equal('like')
    }

    {
      const { rating } = await remoteServer.users.getMyRating({ videoId: externalVideo.uuid, token: remoteNoahToken })
      expect(rating).to.equal('dislike')
    }
  })

  it('Should have correctly imported user video playlists', async function () {
    const { data } = await remoteServer.playlists.listByAccount({ handle: 'noah_remote', token: remoteNoahToken })

    // Should merge the watch later playlists
    expect(data).to.have.lengthOf(3)

    {
      const watchLater = data.find(p => p.type.id === VideoPlaylistType.WATCH_LATER)
      expect(watchLater).to.exist
      expect(watchLater.privacy.id).to.equal(VideoPlaylistPrivacy.PRIVATE)

      // Playlists were merged
      expect(watchLater.videosLength).to.equal(2)

      const { data: videos } = await remoteServer.playlists.listVideos({ playlistId: watchLater.id, token: remoteNoahToken })

      expect(videos[0].position).to.equal(1)
      // Mouska is muted
      expect(videos[0].video).to.not.exist
      expect(videos[1].position).to.equal(2)
      expect(videos[1].video.uuid).to.equal(noahVideo.uuid)

      // Not federated
      await server.playlists.get({ playlistId: watchLater.uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    }

    {
      const playlist1 = data.find(p => p.displayName === 'noah playlist 1')
      expect(playlist1).to.exist

      expect(playlist1.privacy.id).to.equal(VideoPlaylistPrivacy.PUBLIC)
      expect(playlist1.videosLength).to.equal(2) // 1 private video could not be imported

      const { data: videos } = await remoteServer.playlists.listVideos({ playlistId: playlist1.id, token: remoteNoahToken })
      expect(videos[0].position).to.equal(1)
      expect(videos[0].startTimestamp).to.equal(2)
      expect(videos[0].stopTimestamp).to.equal(3)
      expect(videos[0].video).to.not.exist // Mouska is blocked

      expect(videos[1].position).to.equal(2)
      expect(videos[1].video.uuid).to.equal(noahVideo.uuid)

      // Federated
      await server.playlists.get({ playlistId: playlist1.uuid })
    }

    {
      const playlist2 = data.find(p => p.displayName === 'noah playlist 2')
      expect(playlist2).to.exist

      expect(playlist2.privacy.id).to.equal(VideoPlaylistPrivacy.PRIVATE)
      expect(playlist2.videosLength).to.equal(0)

      // Federated
      await server.playlists.get({ playlistId: playlist2.uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    }
  })

  it('Should have correctly imported user video history', async function () {
    const { data } = await remoteServer.history.list({ token: remoteNoahToken })

    expect(data).to.have.lengthOf(2)

    expect(data[0].userHistory.currentTime).to.equal(2)
    expect(data[0].url).to.equal(remoteServer.url + '/videos/watch/' + externalVideo.uuid)

    expect(data[1].userHistory.currentTime).to.equal(4)
    expect(data[1].url).to.equal(server.url + '/videos/watch/' + noahVideo.uuid)
  })

  it('Should have correctly imported user videos', async function () {
    const { data } = await remoteServer.videos.listMyVideos({ token: remoteNoahToken })
    expect(data).to.have.lengthOf(5)

    {
      const privateVideo = data.find(v => v.name === 'noah private video')
      expect(privateVideo).to.exist
      expect(privateVideo.privacy.id).to.equal(VideoPrivacy.PRIVATE)

      // Not federated
      await server.videos.get({ id: privateVideo.uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    }

    {
      const publicVideo = data.find(v => v.name === 'noah public video')
      expect(publicVideo).to.exist
      expect(publicVideo.privacy.id).to.equal(VideoPrivacy.PUBLIC)

      // Federated
      await server.videos.get({ id: publicVideo.uuid })
    }

    {
      const passwordVideo = data.find(v => v.name === 'noah password video')
      expect(passwordVideo).to.exist
      expect(passwordVideo.privacy.id).to.equal(VideoPrivacy.PASSWORD_PROTECTED)

      const { data: passwords } = await remoteServer.videoPasswords.list({ videoId: passwordVideo.uuid })
      expect(passwords.map(p => p.password).sort()).to.deep.equal([ 'password1', 'password2' ])

      // Not federated
      await server.videos.get({ id: passwordVideo.uuid, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
    }

    {
      const otherVideo = data.find(v => v.name === 'noah public video second channel')
      expect(otherVideo).to.exist

      for (const checkServer of [ server, remoteServer ]) {
        await completeVideoCheck({
          server: checkServer,
          originServer: remoteServer,
          videoUUID: otherVideo.uuid,
          objectStorageBaseUrl: objectStorage?.getMockWebVideosBaseUrl(),

          attributes: {
            name: 'noah public video second channel',
            privacy: (VideoPrivacy.PUBLIC),
            category: (12),
            tags: [ 'tag1', 'tag2' ],
            commentsEnabled: false,
            downloadEnabled: false,
            nsfw: false,
            description: ('video description'),
            support: ('video support'),
            language: 'fr',
            licence: 1,
            originallyPublishedAt: new Date(0).toISOString(),
            account: {
              name: 'noah_remote',
              host: remoteServer.host
            },
            likes: 0,
            dislikes: 0,
            duration: 5,
            channel: {
              displayName: 'noah display name',
              name: 'noah_second_channel',
              description: 'noah description'
            },
            fixture: 'video_short.webm',
            files: [
              {
                resolution: 720,
                height: 720,
                width: 1280,
                size: 61000
              },
              {
                resolution: 240,
                height: 240,
                width: 426,
                size: 23000
              }
            ],
            thumbnailfile: 'custom-thumbnail-from-preview',
            previewfile: 'custom-preview'
          }
        })
      }

      await completeCheckHlsPlaylist({
        hlsOnly: false,
        servers: [ remoteServer, server ],
        videoUUID: otherVideo.uuid,
        objectStorageBaseUrl: objectStorage?.getMockPlaylistBaseUrl(),
        resolutions: [ 720, 240 ]
      })

      const source = await remoteServer.videos.getSource({ id: otherVideo.uuid })
      expect(source.filename).to.equal('video_short.webm')
      expect(source.inputFilename).to.equal('video_short.webm')
      expect(source.fileDownloadUrl).to.not.exist

      expect(source.metadata?.format).to.exist
      expect(source.metadata?.streams).to.be.an('array')
    }

    {
      const liveVideo = data.find(v => v.name === 'noah live video')
      expect(liveVideo).to.exist

      await remoteServer.videos.get({ id: liveVideo.uuid, expectedStatus: HttpStatusCode.FORBIDDEN_403 })
      const video = await remoteServer.videos.getWithPassword({ id: liveVideo.uuid, password: 'password1' })
      const live = await remoteServer.live.get({ videoId: liveVideo.uuid, token: remoteNoahToken })

      expect(video.isLive).to.be.true
      expect(live.latencyMode).to.equal(LiveVideoLatencyMode.SMALL_LATENCY)
      expect(live.saveReplay).to.be.true
      expect(live.permanentLive).to.be.true
      expect(live.streamKey).to.exist
      expect(live.replaySettings.privacy).to.equal(VideoPrivacy.PUBLIC)

      expect(video.channel.name).to.equal('noah_second_channel')
      expect(video.privacy.id).to.equal(VideoPrivacy.PASSWORD_PROTECTED)

      expect(video.duration).to.equal(0)
      expect(video.files).to.have.lengthOf(0)
      expect(video.streamingPlaylists).to.have.lengthOf(0)

      expect(video.state.id).to.equal(VideoState.WAITING_FOR_LIVE)
    }
  })

  it('Should re-import the same file', async function () {
    this.timeout(240000)

    const { userImport } = await remoteServer.userImports.importArchive({ fixture: archivePath, userId: remoteNoahId })
    await waitJobs([ remoteServer ])
    latestImportId = userImport.id
  })

  it('Should have the status of this new reimport', async function () {
    const userImport = await remoteServer.userImports.getLatestImport({ userId: remoteNoahId, token: remoteNoahToken })

    expect(userImport.id).to.equal(latestImportId)
    expect(userImport.state.id).to.equal(UserImportState.COMPLETED)
    expect(userImport.state.label).to.equal('Completed')
  })

  it('Should not have duplicated data', async function () {
    // Blocklist
    {
      {
        const { data } = await remoteServer.blocklist.listMyAccountBlocklist({ start: 0, count: 5, token: remoteNoahToken })
        expect(data).to.have.lengthOf(2)
      }

      {
        const { data } = await remoteServer.blocklist.listMyServerBlocklist({ start: 0, count: 5, token: remoteNoahToken })
        expect(data).to.have.lengthOf(1)
      }
    }

    // My avatars
    {
      const me = await remoteServer.users.getMyInfo({ token: remoteNoahToken })
      expect(me.account.avatars).to.have.lengthOf(4)
    }

    // Channels
    {
      const { data: channels } = await remoteServer.channels.listByAccount({ token: remoteNoahToken, accountName: 'noah_remote' })
      expect(channels).to.have.lengthOf(3)
    }

    // Following
    {
      const { data } = await remoteServer.subscriptions.list({ token: remoteNoahToken })
      expect(data).to.have.lengthOf(2)
    }

    // Likes/dislikes
    {
      const video = await remoteServer.videos.get({ id: mouskaVideo.uuid })
      expect(video.likes).to.equal(2)
      expect(video.dislikes).to.equal(0)

      const { rating } = await remoteServer.users.getMyRating({ videoId: mouskaVideo.uuid, token: remoteNoahToken })
      expect(rating).to.equal('like')
    }

    // Playlists
    {
      const { data } = await remoteServer.playlists.listByAccount({ handle: 'noah_remote', token: remoteNoahToken })
      expect(data).to.have.lengthOf(3)
    }

    // Videos
    {
      const { data } = await remoteServer.videos.listMyVideos({ token: remoteNoahToken })
      expect(data).to.have.lengthOf(5)
    }
  })

  it('Should have received an email on finished import', async function () {
    const email = emails.reverse().find(e => {
      return e['to'][0]['address'] === 'noah_remote@example.com' &&
        e['subject'].includes('archive import has finished')
    })

    expect(email).to.exist
    expect(email['text']).to.contain('as considered duplicate: 5') // 5 videos are considered as duplicates
  })

  it('Should auto blacklist imported videos if enabled by the administrator', async function () {
    this.timeout(240000)

    await blockedServer.config.enableAutoBlacklist()

    const { token, userId } = await blockedServer.users.generate('blocked_user')
    await blockedServer.userImports.importArchive({ fixture: archivePath, userId, token })
    await waitJobs([ blockedServer ])

    {
      const { data } = await blockedServer.videos.listMyVideos({ token })
      expect(data).to.have.lengthOf(5)

      for (const video of data) {
        expect(video.blacklisted).to.be.true
      }
    }
  })

  it('Should import original file if included in the export', async function () {
    this.timeout(120000)

    await server.config.enableMinimumTranscoding({ keepOriginal: true })
    await remoteServer.config.keepSourceFile()

    const archivePath = join(server.getDirectoryPath('tmp'), 'archive2.zip')
    const fixture = 'video_short1.webm'

    {
      const { token, userId } = await server.users.generate('claire')

      await server.videos.quickUpload({ name: 'claire video', token, fixture })

      await waitJobs([ server ])

      await server.userExports.request({ userId, token, withVideoFiles: true })
      await server.userExports.waitForCreation({ userId, token })

      await server.userExports.downloadLatestArchive({ userId, token, destination: archivePath })
    }

    {
      const { token, userId } = await remoteServer.users.generate('external_claire')

      await remoteServer.userImports.importArchive({ fixture: archivePath, userId, token })
      await waitJobs([ remoteServer ])

      {
        const { data } = await remoteServer.videos.listMyVideos({ token })
        expect(data).to.have.lengthOf(1)

        const source = await remoteServer.videos.getSource({ id: data[0].id })
        expect(source.filename).to.equal(fixture)
        expect(source.inputFilename).to.equal(fixture)
        expect(source.fileDownloadUrl).to.exist

        expect(source.metadata?.format).to.exist
        expect(source.metadata?.streams).to.be.an('array')
        expect(source.metadata.format['format_name']).to.include('webm')

        expect(source.createdAt).to.exist
        expect(source.fps).to.equal(25)
        expect(source.height).to.equal(720)
        expect(source.width).to.equal(1280)
        expect(source.resolution.id).to.equal(720)
        expect(source.size).to.equal(572456)
      }
    }
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests([ server, remoteServer, blockedServer ])
  })
}

describe('Test user import', function () {

  describe('From filesystem', function () {
    runTest(false)
  })

  describe('From object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    runTest(true)
  })
})
