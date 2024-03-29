/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { wait } from '@peertube/peertube-core-utils'
import {
  AccountExportJSON, ActivityPubActor,
  ActivityPubOrderedCollection,
  AutoTagPoliciesJSON,
  BlocklistExportJSON,
  ChannelExportJSON,
  CommentsExportJSON,
  DislikesExportJSON,
  FollowersExportJSON,
  FollowingExportJSON,
  HttpStatusCode,
  LikesExportJSON,
  LiveVideoLatencyMode,
  UserExportState,
  UserNotificationSettingValue,
  UserSettingsExportJSON,
  UserVideoHistoryExportJSON,
  VideoChapterObject,
  VideoCommentObject,
  VideoCreateResult,
  VideoExportJSON, VideoPlaylistCreateResult,
  VideoPlaylistPrivacy,
  VideoPlaylistsExportJSON,
  VideoPlaylistType,
  VideoPrivacy,
  WatchedWordsListsJSON
} from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests, getRedirectionUrl, makeActivityPubRawRequest,
  makeRawRequest,
  ObjectStorageCommand,
  PeerTubeServer,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expectStartWith } from '@tests/shared/checks.js'
import {
  checkExportFileExists,
  checkFileExistsInZIP,
  downloadZIP,
  findVideoObjectInOutbox,
  parseAPOutbox,
  parseZIPJSONFile,
  prepareImportExportTests,
  regenerateExport
} from '@tests/shared/import-export.js'
import { MockSmtpServer } from '@tests/shared/mock-servers/index.js'
import { expect } from 'chai'

function runTest (withObjectStorage: boolean) {
  let server: PeerTubeServer
  let remoteServer: PeerTubeServer

  let noahToken: string

  let rootId: number
  let noahId: number
  let remoteRootId: number

  const emails: object[] = []

  let externalVideo: VideoCreateResult
  let noahPrivateVideo: VideoCreateResult
  let noahVideo: VideoCreateResult
  let noahLive: VideoCreateResult
  let mouskaVideo: VideoCreateResult

  let noahPlaylist: VideoPlaylistCreateResult

  let noahExportId: number

  let objectStorage: ObjectStorageCommand

  before(async function () {
    this.timeout(240000)

    objectStorage = withObjectStorage
      ? new ObjectStorageCommand()
      : undefined;

    ({
      rootId,
      noahId,
      remoteRootId,
      noahPlaylist,
      externalVideo,
      noahPrivateVideo,
      mouskaVideo,
      noahVideo,
      noahLive,
      noahToken,
      server,
      remoteServer
    } = await prepareImportExportTests({ emails, objectStorage, withBlockedServer: false }))
  })

  it('Should export root account', async function () {
    this.timeout(60000)

    {
      const { data, total } = await server.userExports.list({ userId: rootId })
      expect(total).to.equal(0)
      expect(data).to.have.lengthOf(0)
    }

    const beforeRequest = new Date()
    await server.userExports.request({ userId: rootId, withVideoFiles: false })
    const afterRequest = new Date()

    {
      const { data, total } = await server.userExports.list({ userId: rootId })
      expect(total).to.equal(1)
      expect(data).to.have.lengthOf(1)

      expect(data[0].id).to.exist
      expect(new Date(data[0].createdAt)).to.be.greaterThan(beforeRequest)
      expect(new Date(data[0].createdAt)).to.be.below(afterRequest)

      await server.userExports.waitForCreation({ userId: rootId })
    }

    {
      const { data, total } = await server.userExports.list({ userId: rootId })
      expect(total).to.equal(1)
      expect(data).to.have.lengthOf(1)

      expect(data[0].privateDownloadUrl).to.exist
      expect(data[0].size).to.be.greaterThan(0)
      expect(data[0].state.id).to.equal(UserExportState.COMPLETED)
      expect(data[0].state.label).to.equal('Completed')

      if (objectStorage) {
        expectStartWith(await getRedirectionUrl(data[0].privateDownloadUrl), objectStorage.getMockUserExportBaseUrl())
      }
    }

    await waitJobs([ server ])
  })

  it('Should have received an email on archive creation', async function () {
    const email = emails.find(e => {
      return e['to'][0]['address'] === 'admin' + server.internalServerNumber + '@example.com' &&
        e['subject'].includes('export archive has been created')
    })

    expect(email).to.exist

    expect(email['text']).to.contain('has been created')
    expect(email['text']).to.contain(server.url + '/my-account/import-export')
  })

  it('Should have a valid ZIP for root account', async function () {
    this.timeout(120000)

    const zip = await downloadZIP(server, rootId)

    const files = [
      'activity-pub/actor.json',
      'activity-pub/dislikes.json',
      'activity-pub/following.json',
      'activity-pub/likes.json',
      'activity-pub/outbox.json',

      'peertube/account.json',
      'peertube/blocklist.json',
      'peertube/channels.json',
      'peertube/comments.json',
      'peertube/dislikes.json',
      'peertube/follower.json',
      'peertube/following.json',
      'peertube/likes.json',
      'peertube/user-settings.json',
      'peertube/video-playlists.json',
      'peertube/videos.json',
      'peertube/watched-words-lists.json',
      'peertube/automatic-tag-policies.json'
    ]

    for (const file of files) {
      expect(zip.files[file]).to.exist

      const string = await zip.file(file).async('string')
      expect(string).to.have.length.greaterThan(0)

      expect(JSON.parse(string)).to.not.throw
    }

    const filepaths = Object.keys(zip.files)
    const staticFilepaths = filepaths.filter(p => p.startsWith('files/'))
    expect(staticFilepaths).to.have.lengthOf(0)
  })

  it('Should export Noah account', async function () {
    this.timeout(120000)

    await server.userExports.request({ userId: noahId, withVideoFiles: true })
    await server.userExports.waitForCreation({ userId: noahId })

    const zip = await downloadZIP(server, noahId)

    for (const file of Object.keys(zip.files)) {
      await checkFileExistsInZIP(zip, file)
    }
  })

  it('Should have a valid ActivityPub export', async function () {
    this.timeout(120000)

    const zip = await downloadZIP(server, noahId)

    {
      const actor = await parseZIPJSONFile<ActivityPubActor>(zip, 'activity-pub/actor.json')

      expect(actor['@context']).to.exist
      expect(actor.type).to.equal('Person')
      expect(actor.id).to.equal(server.url + '/accounts/noah')
      expect(actor.following).to.equal('following.json')
      expect(actor.outbox).to.equal('outbox.json')
      expect(actor.preferredUsername).to.equal('noah')
      expect(actor.publicKey).to.exist

      expect(actor.icon).to.have.lengthOf(0)

      expect(actor.likes).to.equal('likes.json')
      expect(actor.dislikes).to.equal('dislikes.json')
    }

    {
      const dislikes = await parseZIPJSONFile<ActivityPubOrderedCollection<string>>(zip, 'activity-pub/dislikes.json')
      expect(dislikes['@context']).to.exist
      expect(dislikes.id).to.equal('dislikes.json')
      expect(dislikes.type).to.equal('OrderedCollection')
      expect(dislikes.totalItems).to.equal(1)
      expect(dislikes.orderedItems).to.have.lengthOf(1)
      expect(dislikes.orderedItems[0]).to.equal(remoteServer.url + '/videos/watch/' + externalVideo.uuid)
    }

    {
      const likes = await parseZIPJSONFile<ActivityPubOrderedCollection<string>>(zip, 'activity-pub/likes.json')
      expect(likes['@context']).to.exist
      expect(likes.id).to.equal('likes.json')
      expect(likes.type).to.equal('OrderedCollection')
      expect(likes.totalItems).to.equal(2)
      expect(likes.orderedItems).to.have.lengthOf(2)
      expect(likes.orderedItems.find(i => i === server.url + '/videos/watch/' + noahVideo.uuid)).to.exist
    }

    {
      const following = await parseZIPJSONFile<ActivityPubOrderedCollection<string>>(zip, 'activity-pub/following.json')
      expect(following['@context']).to.exist
      expect(following.id).to.equal('following.json')
      expect(following.type).to.equal('OrderedCollection')
      expect(following.totalItems).to.equal(2)
      expect(following.orderedItems).to.have.lengthOf(2)
      expect(following.orderedItems.find(i => i === remoteServer.url + '/video-channels/root_channel')).to.exist
    }

    {
      const outbox = await parseAPOutbox(zip)
      expect(outbox['@context']).to.exist
      expect(outbox.id).to.equal('outbox.json')
      expect(outbox.type).to.equal('OrderedCollection')

      // 3 videos and 2 comments
      expect(outbox.totalItems).to.equal(6)
      expect(outbox.orderedItems).to.have.lengthOf(6)

      expect(outbox.orderedItems.filter(i => i.object.type === 'Video')).to.have.lengthOf(4)
      expect(outbox.orderedItems.filter(i => i.object.type === 'Note')).to.have.lengthOf(2)

      {
        const { object: video } = findVideoObjectInOutbox(outbox, 'noah public video')

        // Thumbnail
        expect(video.icon).to.have.lengthOf(1)
        expect(video.icon[0].url).to.equal('../files/videos/thumbnails/' + noahVideo.uuid + '.jpg')

        await checkFileExistsInZIP(zip, video.icon[0].url, '/activity-pub')

        // Subtitles
        expect(video.subtitleLanguage).to.have.lengthOf(2)
        for (const subtitle of video.subtitleLanguage) {
          await checkFileExistsInZIP(zip, subtitle.url, '/activity-pub')
        }

        // Chapters
        expect(video.hasParts).to.have.lengthOf(2)
        const chapters = video.hasParts as VideoChapterObject[]

        expect(chapters[0].name).to.equal('chapter 1')
        expect(chapters[0].startOffset).to.equal(1)
        expect(chapters[0].endOffset).to.equal(3)

        expect(chapters[1].name).to.equal('chapter 2')
        expect(chapters[1].startOffset).to.equal(3)
        expect(chapters[1].endOffset).to.equal(5)

        // Video file
        expect(video.attachment).to.have.lengthOf(1)
        expect(video.attachment[0].url).to.equal('../files/videos/video-files/' + noahVideo.uuid + '.webm')
        await checkFileExistsInZIP(zip, video.attachment[0].url, '/activity-pub')
      }

      {
        const { object: live } = findVideoObjectInOutbox(outbox, 'noah live video')

        expect(live.isLiveBroadcast).to.be.true

        // Thumbnail
        expect(live.icon).to.have.lengthOf(1)
        expect(live.icon[0].url).to.equal('../files/videos/thumbnails/' + noahLive.uuid + '.jpg')
        await checkFileExistsInZIP(zip, live.icon[0].url, '/activity-pub')

        expect(live.subtitleLanguage).to.have.lengthOf(0)
        expect(live.attachment).to.not.exist
      }
    }
  })

  it('Should have a valid export in PeerTube format', async function () {
    this.timeout(120000)

    const zip = await downloadZIP(server, noahId)

    {
      const json = await parseZIPJSONFile<BlocklistExportJSON>(zip, 'peertube/blocklist.json')

      expect(json.instances).to.have.lengthOf(0)
      expect(json.actors).to.have.lengthOf(0)
    }

    {
      const json = await parseZIPJSONFile<FollowersExportJSON>(zip, 'peertube/follower.json')
      expect(json.followers).to.have.lengthOf(2)

      const follower = json.followers.find(f => {
        return f.handle === 'root@' + remoteServer.host
      })

      expect(follower).to.exist
      expect(follower.targetHandle).to.equal('noah_channel@' + server.host)
      expect(follower.createdAt).to.exist
    }

    {
      const json = await parseZIPJSONFile<FollowingExportJSON>(zip, 'peertube/following.json')
      expect(json.following).to.have.lengthOf(2)

      const following = json.following.find(f => {
        return f.targetHandle === 'mouska_channel@' + server.host
      })

      expect(following).to.exist
      expect(following.handle).to.equal('noah@' + server.host)
      expect(following.createdAt).to.exist
    }

    {
      const json = await parseZIPJSONFile<LikesExportJSON>(zip, 'peertube/likes.json')
      expect(json.likes).to.have.lengthOf(2)

      const like = json.likes.find(l => {
        return l.videoUrl === server.url + '/videos/watch/' + mouskaVideo.uuid
      })
      expect(like).to.exist
      expect(like.createdAt).to.exist
    }

    {
      const json = await parseZIPJSONFile<DislikesExportJSON>(zip, 'peertube/dislikes.json')
      expect(json.dislikes).to.have.lengthOf(1)

      const dislike = json.dislikes.find(l => {
        return l.videoUrl === remoteServer.url + '/videos/watch/' + externalVideo.uuid
      })
      expect(dislike).to.exist
      expect(dislike.createdAt).to.exist
    }

    {
      const json = await parseZIPJSONFile<UserSettingsExportJSON>(zip, 'peertube/user-settings.json')
      expect(json.email).to.equal('noah@example.com')
      expect(json.p2pEnabled).to.be.false
      expect(json.notificationSettings.myVideoPublished).to.equal(UserNotificationSettingValue.NONE)
      expect(json.notificationSettings.commentMention).to.equal(UserNotificationSettingValue.EMAIL)
    }

    {
      const json = await parseZIPJSONFile<AccountExportJSON>(zip, 'peertube/account.json')
      expect(json.displayName).to.equal('noah')
      expect(json.description).to.equal('super noah description')
      expect(json.name).to.equal('noah')
      expect(json.avatars).to.have.lengthOf(0)
    }

    {
      const json = await parseZIPJSONFile<VideoPlaylistsExportJSON>(zip, 'peertube/video-playlists.json')

      expect(json.videoPlaylists).to.have.lengthOf(3)

      // Watch later
      {
        expect(json.videoPlaylists.find(p => p.type === VideoPlaylistType.WATCH_LATER)).to.exist
      }

      {
        const playlist1 = json.videoPlaylists.find(p => p.displayName === 'noah playlist 1')
        expect(playlist1.privacy).to.equal(VideoPlaylistPrivacy.PUBLIC)
        expect(playlist1.channel.name).to.equal('noah_channel')
        expect(playlist1.elements).to.have.lengthOf(3)
        expect(playlist1.type).to.equal(VideoPlaylistType.REGULAR)

        await makeRawRequest({ url: playlist1.thumbnailUrl, expectedStatus: HttpStatusCode.OK_200 })

        expect(playlist1.elements.find(e => e.videoUrl === server.url + '/videos/watch/' + mouskaVideo.uuid)).to.exist
        expect(playlist1.elements.find(e => e.videoUrl === server.url + '/videos/watch/' + noahPrivateVideo.uuid)).to.exist
      }

      {
        const playlist2 = json.videoPlaylists.find(p => p.displayName === 'noah playlist 2')
        expect(playlist2.privacy).to.equal(VideoPlaylistPrivacy.PRIVATE)
        expect(playlist2.channel.name).to.not.exist
        expect(playlist2.elements).to.have.lengthOf(0)
        expect(playlist2.type).to.equal(VideoPlaylistType.REGULAR)
        expect(playlist2.thumbnailUrl).to.not.exist
      }
    }

    {
      const json = await parseZIPJSONFile<ChannelExportJSON>(zip, 'peertube/channels.json')

      expect(json.channels).to.have.lengthOf(2)

      {
        const mainChannel = json.channels.find(c => c.name === 'noah_channel')
        expect(mainChannel.displayName).to.equal('Main noah channel')
        expect(mainChannel.avatars).to.have.lengthOf(0)
        expect(mainChannel.banners).to.have.lengthOf(0)
      }

      {
        const secondaryChannel = json.channels.find(c => c.name === 'noah_second_channel')
        expect(secondaryChannel.displayName).to.equal('noah display name')
        expect(secondaryChannel.description).to.equal('noah description')
        expect(secondaryChannel.support).to.equal('noah support')

        expect(secondaryChannel.avatars).to.have.lengthOf(4)
        expect(secondaryChannel.banners).to.have.lengthOf(2)

        const urls = [ ...secondaryChannel.avatars, ...secondaryChannel.banners ].map(a => a.url)
        for (const url of urls) {
          await makeRawRequest({ url, expectedStatus: HttpStatusCode.OK_200 })
        }
      }
    }

    {
      const json = await parseZIPJSONFile<CommentsExportJSON>(zip, 'peertube/comments.json')

      expect(json.comments).to.have.lengthOf(2)

      {
        const thread = json.comments.find(c => c.text === 'noah comment')

        expect(thread.videoUrl).to.equal(server.url + '/videos/watch/' + mouskaVideo.uuid)
        expect(thread.inReplyToCommentUrl).to.not.exist
      }

      {
        const reply = json.comments.find(c => c.text === 'noah reply')

        expect(reply.videoUrl).to.equal(server.url + '/videos/watch/' + noahVideo.uuid)
        expect(reply.inReplyToCommentUrl).to.exist

        const { body } = await makeActivityPubRawRequest(reply.inReplyToCommentUrl)
        expect((body as VideoCommentObject).content).to.equal('local comment')
      }
    }

    {
      const json = await parseZIPJSONFile<UserVideoHistoryExportJSON>(zip, 'peertube/video-history.json')

      expect(json.watchedVideos).to.have.lengthOf(2)

      expect(json.watchedVideos[0].createdAt).to.exist
      expect(json.watchedVideos[0].updatedAt).to.exist
      expect(json.watchedVideos[0].lastTimecode).to.equal(4)
      expect(json.watchedVideos[0].videoUrl).to.equal(server.url + '/videos/watch/' + noahVideo.uuid)

      expect(json.watchedVideos[1].createdAt).to.exist
      expect(json.watchedVideos[1].updatedAt).to.exist
      expect(json.watchedVideos[1].lastTimecode).to.equal(2)
      expect(json.watchedVideos[1].videoUrl).to.equal(remoteServer.url + '/videos/watch/' + externalVideo.uuid)
    }

    {
      const json = await parseZIPJSONFile<VideoExportJSON>(zip, 'peertube/videos.json')

      expect(json.videos).to.have.lengthOf(4)

      {
        const privateVideo = json.videos.find(v => v.name === 'noah private video')
        expect(privateVideo).to.exist

        expect(privateVideo.channel.name).to.equal('noah_channel')
        expect(privateVideo.privacy).to.equal(VideoPrivacy.PRIVATE)

        expect(privateVideo.captions).to.have.lengthOf(0)
      }

      {
        const publicVideo = json.videos.find(v => v.name === 'noah public video')
        expect(publicVideo).to.exist

        expect(publicVideo.channel.name).to.equal('noah_channel')
        expect(publicVideo.privacy).to.equal(VideoPrivacy.PUBLIC)

        expect(publicVideo.files).to.have.lengthOf(1)
        expect(publicVideo.streamingPlaylists).to.have.lengthOf(0)

        expect(publicVideo.chapters).to.have.lengthOf(2)

        expect(publicVideo.captions).to.have.lengthOf(2)

        expect(publicVideo.captions.find(c => c.language === 'ar')).to.exist
        expect(publicVideo.captions.find(c => c.language === 'fr')).to.exist

        const urls = [
          ...publicVideo.captions.map(c => c.fileUrl),
          ...publicVideo.files.map(f => f.fileUrl),
          publicVideo.thumbnailUrl
        ]

        for (const url of urls) {
          await makeRawRequest({ url, expectedStatus: HttpStatusCode.OK_200 })
        }

        expect(publicVideo.source.inputFilename).to.equal('video_short.webm')
        expect(publicVideo.source.fps).to.equal(25)
        expect(publicVideo.source.height).to.equal(720)
        expect(publicVideo.source.width).to.equal(1280)
        expect(publicVideo.source.metadata?.streams).to.exist
        expect(publicVideo.source.resolution).to.equal(720)
        expect(publicVideo.source.size).to.equal(218910)
      }

      {
        const liveVideo = json.videos.find(v => v.name === 'noah live video')
        expect(liveVideo).to.exist

        expect(liveVideo.isLive).to.be.true
        expect(liveVideo.live.latencyMode).to.equal(LiveVideoLatencyMode.SMALL_LATENCY)
        expect(liveVideo.live.saveReplay).to.be.true
        expect(liveVideo.live.permanentLive).to.be.true
        expect(liveVideo.live.streamKey).to.exist
        expect(liveVideo.live.replaySettings.privacy).to.equal(VideoPrivacy.PUBLIC)

        expect(liveVideo.channel.name).to.equal('noah_second_channel')
        expect(liveVideo.privacy).to.equal(VideoPrivacy.PASSWORD_PROTECTED)
        expect(liveVideo.passwords).to.deep.equal([ 'password1' ])

        expect(liveVideo.duration).to.equal(0)
        expect(liveVideo.captions).to.have.lengthOf(0)
        expect(liveVideo.files).to.have.lengthOf(0)
        expect(liveVideo.streamingPlaylists).to.have.lengthOf(0)
        expect(liveVideo.source).to.not.exist

        expect(liveVideo.archiveFiles.captions).to.deep.equal({})
        expect(liveVideo.archiveFiles.thumbnail).to.exist
        expect(liveVideo.archiveFiles.videoFile).to.not.exist
      }

      {
        const secondaryChannelVideo = json.videos.find(v => v.name === 'noah public video second channel')
        expect(secondaryChannelVideo.channel.name).to.equal('noah_second_channel')
      }
    }

    {
      const json = await parseZIPJSONFile<WatchedWordsListsJSON>(zip, 'peertube/watched-words-lists.json')

      expect(json.watchedWordLists).to.have.lengthOf(2)

      expect(json.watchedWordLists[0].createdAt).to.exist
      expect(json.watchedWordLists[0].updatedAt).to.exist
      expect(json.watchedWordLists[0].listName).to.equal('forbidden-list')
      expect(json.watchedWordLists[0].words).to.have.members([ 'forbidden' ])

      expect(json.watchedWordLists[1].createdAt).to.exist
      expect(json.watchedWordLists[1].updatedAt).to.exist
      expect(json.watchedWordLists[1].listName).to.equal('allowed-list')
      expect(json.watchedWordLists[1].words).to.have.members([ 'allowed', 'allowed2' ])
    }

    {
      const json = await parseZIPJSONFile<AutoTagPoliciesJSON>(zip, 'peertube/automatic-tag-policies.json')
      expect(json.reviewComments).to.have.lengthOf(2)
      expect(json.reviewComments.map(r => r.name)).to.have.members([ 'external-link', 'forbidden-list' ])
    }
  })

  it('Should have a valid export of static files', async function () {
    this.timeout(60000)

    const zip = await downloadZIP(server, noahId)
    const files = Object.keys(zip.files)

    {
      expect(zip.files['files/account/avatars/noah.jpg']).to.not.exist
    }

    {
      const playlistFiles = files.filter(f => f.startsWith('files/video-playlists/thumbnails/'))
      expect(playlistFiles).to.have.lengthOf(1)

      await checkFileExistsInZIP(zip, 'files/video-playlists/thumbnails/' + noahPlaylist.uuid + '.jpg')
    }

    {
      const channelAvatarFiles = files.filter(f => f.startsWith('files/channels/avatars/'))
      expect(channelAvatarFiles).to.have.lengthOf(1)

      const channelBannerFiles = files.filter(f => f.startsWith('files/channels/banners/'))
      expect(channelBannerFiles).to.have.lengthOf(1)

      await checkFileExistsInZIP(zip, 'files/channels/avatars/noah_second_channel.png')
      await checkFileExistsInZIP(zip, 'files/channels/banners/noah_second_channel.jpg')
    }

    {
      const videoThumbnails = files.filter(f => f.startsWith('files/videos/thumbnails/'))
      expect(videoThumbnails).to.have.lengthOf(4)

      const videoFiles = files.filter(f => f.startsWith('files/videos/video-files/'))
      expect(videoFiles).to.have.lengthOf(3)

      await checkFileExistsInZIP(zip, 'files/videos/thumbnails/' + noahPrivateVideo.uuid + '.jpg')
      await checkFileExistsInZIP(zip, 'files/videos/video-files/' + noahPrivateVideo.uuid + '.webm')
    }
  })

  it('Should not export Noah videos', async function () {
    this.timeout(60000)

    await regenerateExport({ server, userId: noahId, withVideoFiles: false })

    const zip = await downloadZIP(server, noahId)

    {
      const outbox = await parseAPOutbox(zip)
      const { object: video } = findVideoObjectInOutbox(outbox, 'noah public video')

      expect(video.attachment).to.not.exist
    }

    {
      const files = Object.keys(zip.files)

      const videoFiles = files.filter(f => f.startsWith('files/videos/video-files/'))
      expect(videoFiles).to.have.lengthOf(0)
    }
  })

  it('Should update my avatar and include it in the archive', async function () {
    this.timeout(60000)

    await server.users.updateMyAvatar({ token: noahToken, fixture: 'avatar.png' })

    await regenerateExport({ server, userId: noahId, withVideoFiles: false })

    const zip = await downloadZIP(server, noahId)

    // AP
    {
      const actor = await parseZIPJSONFile<ActivityPubActor>(zip, 'activity-pub/actor.json')

      expect(actor.icon).to.have.lengthOf(1)

      await checkFileExistsInZIP(zip, actor.icon[0].url, '/activity-pub')
    }

    // PeerTube format
    {
      const json = await parseZIPJSONFile<AccountExportJSON>(zip, 'peertube/account.json')
      expect(json.avatars).to.have.lengthOf(4)

      for (const avatar of json.avatars) {
        await makeRawRequest({ url: avatar.url, expectedStatus: HttpStatusCode.OK_200 })
      }
    }

    {
      await checkFileExistsInZIP(zip, 'files/account/avatars/noah.png')
    }
  })

  it('Should add account and server in blocklist and include it in the archive', async function () {
    this.timeout(60000)

    const blocks = [
      { account: 'root' },
      { account: 'root@' + remoteServer.host },
      { server: remoteServer.host }
    ]

    for (const toBlock of blocks) {
      await server.blocklist.addToMyBlocklist({ token: noahToken, ...toBlock })
    }

    const { export: { id } } = await regenerateExport({ server, userId: noahId, withVideoFiles: false })
    noahExportId = id

    const zip = await downloadZIP(server, noahId)
    const json = await parseZIPJSONFile<BlocklistExportJSON>(zip, 'peertube/blocklist.json')

    expect(json.instances).to.have.lengthOf(1)
    expect(json.instances[0].host).to.equal(remoteServer.host)

    expect(json.actors).to.have.lengthOf(2)
    expect(json.actors.find(a => a.handle === 'root@' + server.host)).to.exist
    expect(json.actors.find(a => a.handle === 'root@' + remoteServer.host)).to.exist

    for (const toBlock of blocks) {
      await server.blocklist.removeFromMyBlocklist({ token: noahToken, ...toBlock })
    }
  })

  it('Should export videos on instance with transcoding enabled', async function () {
    await regenerateExport({ server: remoteServer, userId: remoteRootId, withVideoFiles: true })

    const zip = await downloadZIP(remoteServer, remoteRootId)

    {
      const json = await parseZIPJSONFile<VideoExportJSON>(zip, 'peertube/videos.json')

      expect(json.videos).to.have.lengthOf(1)
      const video = json.videos[0]

      expect(video.files).to.have.lengthOf(2)
      expect(video.streamingPlaylists).to.have.lengthOf(1)
      expect(video.streamingPlaylists[0].files).to.have.lengthOf(2)
    }

    {
      const outbox = await parseAPOutbox(zip)
      const { object: video } = findVideoObjectInOutbox(outbox, 'external video')

      expect(video.attachment).to.have.lengthOf(1)
      expect(video.attachment[0].url).to.equal('../files/videos/video-files/' + externalVideo.uuid + '.mp4')
      await checkFileExistsInZIP(zip, video.attachment[0].url, '/activity-pub')
    }
  })

  it('Should delete the export and clean up the disk', async function () {
    const { data, total } = await server.userExports.list({ userId: noahId })
    expect(data).to.have.lengthOf(1)
    expect(total).to.equal(1)

    const userExport = data[0]
    const redirectedUrl = withObjectStorage
      ? await getRedirectionUrl(userExport.privateDownloadUrl)
      : undefined

    await checkExportFileExists({ exists: true, server, userExport, redirectedUrl, withObjectStorage })

    await server.userExports.delete({ userId: noahId, exportId: noahExportId, token: noahToken })

    {
      const { data, total } = await server.userExports.list({ userId: noahId })
      expect(data).to.have.lengthOf(0)
      expect(total).to.equal(0)

      await checkExportFileExists({ exists: false, server, userExport, redirectedUrl, withObjectStorage })
    }
  })

  it('Should remove the user and cleanup the disk', async function () {
    this.timeout(60000)

    const { token, userId } = await server.users.generate('to_delete')
    await server.userExports.request({ userId, token, withVideoFiles: false })
    await server.userExports.waitForCreation({ userId, token })

    const { data } = await server.userExports.list({ userId })

    const userExport = data[0]
    const redirectedUrl = withObjectStorage
      ? await getRedirectionUrl(userExport.privateDownloadUrl)
      : undefined

    await checkExportFileExists({ exists: true, server, userExport, redirectedUrl, withObjectStorage })

    await server.users.remove({ userId })

    await checkExportFileExists({ exists: false, server, userExport, redirectedUrl, withObjectStorage })
  })

  it('Should expire old archives', async function () {
    this.timeout(60000)

    await server.userExports.request({ userId: noahId, withVideoFiles: true })
    await server.userExports.waitForCreation({ userId: noahId })

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { data } = await server.userExports.list({ userId: noahId })
    expect(new Date(data[0].expiresOn)).to.be.greaterThan(tomorrow)

    const userExport = data[0]
    const redirectedUrl = withObjectStorage
      ? await getRedirectionUrl(userExport.privateDownloadUrl)
      : undefined

    await checkExportFileExists({ exists: true, server, userExport, withObjectStorage, redirectedUrl })

    await server.config.updateExistingConfig({
      newConfig: {
        export: {
          users: {
            exportExpiration: 1000
          }
        }
      }
    })

    await server.debug.sendCommand({
      body: {
        command: 'remove-expired-user-exports'
      }
    })

    // File deletion
    await wait(500)

    {
      const { data } = await server.userExports.list({ userId: noahId })
      expect(data).to.have.lengthOf(0)

      await checkExportFileExists({ exists: false, server, userExport, withObjectStorage, redirectedUrl })
    }
  })

  after(async function () {
    MockSmtpServer.Instance.kill()

    await cleanupTests([ server, remoteServer ])
  })
}

describe('Test user export', function () {

  describe('From filesystem', function () {
    runTest(false)
  })

  describe('From object storage', function () {
    if (areMockObjectStorageTestsDisabled()) return

    runTest(true)
  })
})
