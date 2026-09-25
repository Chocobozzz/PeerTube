/* oxlint-disable @typescript-eslint/no-unused-expressions */

import { getAllFiles } from '@peertube/peertube-core-utils'
import {
  FileStorage,
  FileStorageType,
  HttpStatusCode,
  VideoDetails,
  VideoPlaylistPrivacy,
  VideoResolution,
  VideoState
} from '@peertube/peertube-models'
import { areMockObjectStorageTestsDisabled } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  createMultipleServers,
  createSingleServer,
  doubleFollow,
  getRedirectionUrl,
  makeRawRequest,
  ObjectStorageCommand,
  OptionalObjectStorageType,
  PeerTubeServer,
  setAccessTokensToServers,
  setDefaultAccountAvatar,
  setDefaultVideoChannel,
  waitJobs
} from '@peertube/peertube-server-commands'
import { expectStartWith } from '@tests/shared/checks.js'
import { checkDirectoryIsEmpty } from '@tests/shared/directories.js'
import { completeCheckHlsPlaylist } from '@tests/shared/streaming-playlists.js'
import { expect } from 'chai'
import { move, pathExists } from 'fs-extra/esm'
import { basename, join } from 'path'

const FS = FileStorage.FILE_SYSTEM
const OS = FileStorage.OBJECT_STORAGE

async function checkVideoFiles (options: {
  origin: PeerTubeServer
  video: VideoDetails
  objectStorage?: ObjectStorageCommand
}) {
  const { origin, video, objectStorage } = options

  // Web videos
  for (const file of video.files) {
    const start = objectStorage
      ? objectStorage.getMockWebVideosBaseUrl()
      : origin.url

    expectStartWith(file.fileUrl, start)

    await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
  }

  // Playlists
  {
    const start = objectStorage
      ? objectStorage.getMockPlaylistBaseUrl()
      : origin.url

    const hls = video.streamingPlaylists[0]
    expectStartWith(hls.playlistUrl, start)
    expectStartWith(hls.segmentsSha256Url, start)

    for (const file of hls.files) {
      expectStartWith(file.fileUrl, start)

      await makeRawRequest({ url: file.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
    }
  }

  // Original file
  {
    const source = await origin.videos.getSource({ id: video.uuid })

    if (objectStorage) {
      await makeRawRequest({ url: source.fileDownloadUrl, token: origin.accessToken, expectedStatus: HttpStatusCode.FOUND_302 })

      const redirected = await getRedirectionUrl(source.fileDownloadUrl, origin.accessToken)
      expectStartWith(redirected, objectStorage.getMockOriginalFileBaseUrl())
    } else {
      await makeRawRequest({ url: source.fileDownloadUrl, token: origin.accessToken, expectedStatus: HttpStatusCode.OK_200 })
      expectStartWith(source.fileDownloadUrl, origin.url)
    }
  }

  // Captions
  {
    const start = objectStorage
      ? objectStorage.getMockCaptionFileBaseUrl()
      : origin.url

    const { data: captions } = await origin.captions.list({ videoId: video.uuid })

    for (const caption of captions) {
      expectStartWith(caption.fileUrl, start)

      await makeRawRequest({ url: caption.fileUrl, expectedStatus: HttpStatusCode.OK_200 })
    }

    await completeCheckHlsPlaylist({
      servers: [ origin ],
      videoUUID: video.uuid,
      hlsOnly: false,
      hasAudio: true,
      hasVideo: true,
      captions,
      objectStorageBaseUrl: objectStorage?.getMockPlaylistBaseUrl(),
      resolutions: [ VideoResolution.H_720P, VideoResolution.H_240P ]
    })
  }
}

describe('Test create move file storage job CLI', function () {
  if (areMockObjectStorageTestsDisabled()) return

  const objectStorage = new ObjectStorageCommand()

  describe('Video files, original files and captions', function () {
    let servers: PeerTubeServer[] = []
    const uuids: string[] = []

    before(async function () {
      this.timeout(360000)

      // Run server 2 to have transcoding enabled
      servers = await createMultipleServers(2)
      await setAccessTokensToServers(servers)

      await doubleFollow(servers[0], servers[1])

      await objectStorage.prepareDefaultMockBuckets()

      await servers[0].config.enableMinimumTranscoding({ keepOriginal: true })

      for (let i = 0; i < 3; i++) {
        const { uuid } = await servers[0].videos.quickUpload({ name: 'video' + i })

        await servers[0].captions.add({ language: 'ar', videoId: uuid, fixture: 'subtitle-good1.vtt' })
        await servers[0].captions.add({ language: 'zh', videoId: uuid, fixture: 'subtitle-good1.vtt' })

        uuids.push(uuid)
      }

      await waitJobs(servers)

      await servers[0].kill()
      await servers[0].run(objectStorage.getDefaultMockConfig())
    })

    describe('To object storage', function () {
      it('Should move only one file', async function () {
        this.timeout(120000)

        const command = `npm run create-move-file-storage-job -- --to-object-storage -v ${uuids[1]}`
        await servers[0].cli.execWithEnv(command, objectStorage.getDefaultMockConfig())
        await waitJobs(servers)

        for (const server of servers) {
          const video = await server.videos.get({ id: uuids[1] })

          await checkVideoFiles({ origin: servers[0], video, objectStorage })

          for (const id of [ uuids[0], uuids[2] ]) {
            const video = await server.videos.get({ id })

            await checkVideoFiles({ origin: servers[0], video })
          }
        }
      })

      it('Should move all files', async function () {
        this.timeout(120000)

        const command = `npm run create-move-file-storage-job -- --to-object-storage --all-videos`
        await servers[0].cli.execWithEnv(command, objectStorage.getDefaultMockConfig())
        await waitJobs(servers)

        for (const server of servers) {
          for (const id of [ uuids[0], uuids[2] ]) {
            const video = await server.videos.get({ id })

            await checkVideoFiles({ origin: servers[0], video, objectStorage })
          }
        }
      })

      it('Should not re-move all files', async function () {
        const command = `npm run create-move-file-storage-job -- --to-object-storage --all-videos`
        const { stdout } = await servers[0].cli.execWithEnv(command, objectStorage.getDefaultMockConfig())

        expect(stdout).to.not.include('Creating external storage move job ')

        await waitJobs(servers)
      })

      it('Should not have files on disk anymore', async function () {
        await checkDirectoryIsEmpty(servers[0], 'captions', [ 'private' ])

        await checkDirectoryIsEmpty(servers[0], 'web-videos', [ 'private' ])
        await checkDirectoryIsEmpty(servers[0], join('web-videos', 'private'))

        await checkDirectoryIsEmpty(servers[0], join('streaming-playlists', 'hls'), [ 'private' ])
        await checkDirectoryIsEmpty(servers[0], join('streaming-playlists', 'hls', 'private'))
      })
    })

    describe('To file system', function () {
      let oldFileUrls: string[]

      before(async function () {
        const video = await servers[0].videos.get({ id: uuids[1] })
        const { data: captions } = await servers[0].captions.list({ videoId: uuids[1] })

        oldFileUrls = [
          ...getAllFiles(video).map(f => f.fileUrl),

          ...captions.map(c => c.fileUrl),
          ...captions.map(c => c.m3u8Url),

          video.streamingPlaylists[0].playlistUrl
        ]
      })

      it('Should move only one file', async function () {
        this.timeout(120000)

        const command = `npm run create-move-file-storage-job -- --to-file-system -v ${uuids[1]}`
        await servers[0].cli.execWithEnv(command, objectStorage.getDefaultMockConfig())
        await waitJobs(servers)

        for (const server of servers) {
          const video = await server.videos.get({ id: uuids[1] })

          await checkVideoFiles({ origin: servers[0], video })

          for (const id of [ uuids[0], uuids[2] ]) {
            const video = await server.videos.get({ id })

            await checkVideoFiles({ origin: servers[0], video, objectStorage })
          }
        }
      })

      it('Should move all files using the deprecated command name', async function () {
        this.timeout(120000)

        // TODO: remove in v10 with the deprecated create-move-video-storage-job script
        const command = `npm run create-move-video-storage-job -- --to-file-system --all-videos`
        const { stderr } = await servers[0].cli.execWithEnv(command, objectStorage.getDefaultMockConfig())
        expect(stderr).to.include('create-move-video-storage-job is deprecated')

        await waitJobs(servers)

        for (const server of servers) {
          for (const id of [ uuids[0], uuids[2] ]) {
            const video = await server.videos.get({ id })

            await checkVideoFiles({ origin: servers[0], video })
          }
        }
      })

      it('Should not re-move all files', async function () {
        // Keep create-move-video-storage-job on purpose to also test the deprecated command name handling
        const command = `npm run create-move-video-storage-job -- --to-file-system --all-videos`
        const { stdout } = await servers[0].cli.execWithEnv(command, objectStorage.getDefaultMockConfig())

        expect(stdout).to.not.include('Creating move to file ')

        await waitJobs(servers)
      })

      it('Should not have files on disk anymore', async function () {
        for (const fileUrl of oldFileUrls) {
          await makeRawRequest({ url: fileUrl, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
        }
      })
    })

    after(async function () {
      await objectStorage.cleanupMock()

      await cleanupTests(servers)
    })
  })

  // Avatars, thumbnails, storyboards, torrents and uploads can be moved independently of video files
  describe('Avatars, thumbnails, storyboards, torrents and uploads', function () {
    let server: PeerTubeServer
    // Follows server, to check moved files are federated with their new URL
    let remoteServer: PeerTubeServer
    const uuids: string[] = []
    let playlistUUID: string

    const allOptionalTypes: OptionalObjectStorageType[] = [ 'avatars', 'thumbnails', 'storyboards', 'torrents', 'uploads' ]

    // Where each file is expected to be
    const state = {
      videos: {} as { [uuid: string]: { thumbnails: FileStorageType, storyboards: FileStorageType, torrents: FileStorageType } },
      actorImages: FS as FileStorageType,
      playlistThumbnails: FS as FileStorageType,
      uploads: FS as FileStorageType
    }

    // URLs of files served by the instance, by filename, to check they still work once moved to object storage
    const instanceUrls = new Map<string, string>()

    function setVideoState (uuid: string, storage: FileStorageType) {
      state.videos[uuid] = { thumbnails: storage, storyboards: storage, torrents: storage }
    }

    function buildConfig (enabledOptionalTypes: OptionalObjectStorageType[] = allOptionalTypes) {
      return objectStorage.getDefaultMockConfig({ enabledOptionalTypes })
    }

    async function restartWith (config: object) {
      await server.kill()
      await server.run(config)
    }

    async function runMove (args: string, config: object = buildConfig()) {
      const { stdout } = await server.cli.execWithEnv(`npm run create-move-file-storage-job -- ${args}`, config)
      await waitJobs([ server, remoteServer ])

      return stdout
    }

    function getStorageInfo (type: OptionalObjectStorageType) {
      switch (type) {
        case 'avatars':
          return { directory: 'avatars', bucketBaseUrl: objectStorage.getMockActorImagesBaseUrl() }
        case 'thumbnails':
          return { directory: 'thumbnails', bucketBaseUrl: objectStorage.getMockThumbnailsBaseUrl() }
        case 'storyboards':
          return { directory: 'storyboards', bucketBaseUrl: objectStorage.getMockStoryboardsBaseUrl() }
        case 'torrents':
          return { directory: 'torrents', bucketBaseUrl: objectStorage.getMockTorrentsBaseUrl() }
        case 'uploads':
          return { directory: join('uploads', 'images'), bucketBaseUrl: objectStorage.getMockUploadsBaseUrl() }
      }
    }

    async function checkFiles (type: OptionalObjectStorageType, urls: string[], storage: FileStorageType) {
      expect(urls, type).to.have.length.above(0)

      const { directory, bucketBaseUrl } = getStorageInfo(type)
      const onObjectStorage = storage === OS

      for (const url of urls) {
        const filename = basename(url)

        expectStartWith(url, onObjectStorage ? bucketBaseUrl : server.url)

        await makeRawRequest({ url, expectedStatus: HttpStatusCode.OK_200 })

        // Torrents are proxified (checked below)
        if (type !== 'torrents') {
          if (onObjectStorage) {
            if (instanceUrls.has(filename)) {
              expect(await getRedirectionUrl(instanceUrls.get(filename)), `${type} ${url}`).to.equal(url)
            }
          } else {
            instanceUrls.set(filename, url)
          }
        }

        // Torrent URLs published before a move to object storage keep working
        if (type === 'torrents') {
          await makeRawRequest({ url: server.url + '/lazy-static/torrents/' + filename, expectedStatus: HttpStatusCode.OK_200 })
        }

        await makeRawRequest({
          url: bucketBaseUrl + filename,
          expectedStatus: onObjectStorage ? HttpStatusCode.OK_200 : HttpStatusCode.NOT_FOUND_404
        })

        expect(await pathExists(join(server.servers.buildDirectory(directory), filename)), `${type} ${url}`).to.equal(!onObjectStorage)
      }
    }

    async function getRemoteUrls () {
      const account = await remoteServer.accounts.get({ accountName: 'root@' + server.host })
      const playlist = await remoteServer.playlists.get({ playlistId: playlistUUID })

      return {
        avatars: account.avatars.map(a => a.fileUrl),
        playlistThumbnails: playlist.thumbnails.map(t => t.fileUrl)
      }
    }

    // The remote instance replaces its cached files only if it received the new URLs of the moved files
    async function checkRemoteUrlsUpdated (previous: string[], current: string[]) {
      expect(previous).to.have.length.above(0)
      expect(current).to.have.lengthOf(previous.length)

      for (const url of current) {
        expect(previous).to.not.include(url)

        await makeRawRequest({ url, expectedStatus: HttpStatusCode.OK_200 })
      }
    }

    async function checkState () {
      for (const uuid of uuids) {
        const video = await server.videos.get({ id: uuid })
        const { storyboards } = await server.storyboard.list({ id: uuid })

        await checkFiles('thumbnails', video.thumbnails.map(t => t.fileUrl), state.videos[uuid].thumbnails)
        await checkFiles('storyboards', storyboards.map(s => s.fileUrl), state.videos[uuid].storyboards)
        await checkFiles('torrents', video.files.map(f => f.torrentUrl), state.videos[uuid].torrents)
      }

      {
        const me = await server.users.getMyInfo()
        const channel = await server.channels.get({ channelName: server.store.channel.name })

        await checkFiles(
          'avatars',
          [ ...me.account.avatars.map(a => a.fileUrl), ...channel.banners.map(b => b.fileUrl) ],
          state.actorImages
        )
      }

      {
        const playlist = await server.playlists.get({ playlistId: playlistUUID })

        await checkFiles('thumbnails', playlist.thumbnails.map(t => t.fileUrl), state.playlistThumbnails)
      }

      {
        const config = await server.config.getConfig()

        await checkFiles('uploads', config.instance.logo.filter(l => !l.isFallback).map(l => l.fileUrl), state.uploads)
      }
    }

    before(async function () {
      this.timeout(240000)

      await objectStorage.prepareDefaultMockBuckets()

      // Start on the file system: object storage is entirely disabled
      server = await createSingleServer(1)
      remoteServer = await createSingleServer(2)

      await setAccessTokensToServers([ server, remoteServer ])
      await setDefaultVideoChannel([ server ])

      await doubleFollow(server, remoteServer)

      await setDefaultAccountAvatar([ server ])

      await server.config.disableTranscoding()

      for (const name of [ 'video 1', 'video 2' ]) {
        const { uuid } = await server.videos.quickUpload({ name })

        uuids.push(uuid)
        setVideoState(uuid, FS)
      }

      await server.channels.updateImage({ channelName: server.store.channel.name, fixture: 'banner.jpg', type: 'banner' })

      const { uuid: createdPlaylistUUID } = await server.playlists.create({
        attributes: {
          displayName: 'playlist',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: server.store.channel.id,
          thumbnailfile: 'custom-thumbnail-280x157.jpg'
        }
      })
      playlistUUID = createdPlaylistUUID

      await server.config.updateInstanceLogo({ fixture: 'avatar.png', type: 'favicon' })

      await waitJobs([ server, remoteServer ])
    })

    describe('Individual moves', function () {
      before(async function () {
        this.timeout(120000)

        await restartWith(buildConfig())
      })

      it('Should have created everything on the file system', async function () {
        await checkState()
      })

      it('Should refuse to move files to object storage if it is not enabled for their type', async function () {
        this.timeout(120000)

        const cases: { args: string, type: OptionalObjectStorageType }[] = [
          { args: '--all-actor-images', type: 'avatars' },
          { args: '--all-playlists', type: 'thumbnails' },
          { args: '--all-uploads', type: 'uploads' }
        ]

        for (const { args, type } of cases) {
          const config = buildConfig(allOptionalTypes.filter(t => t !== type))

          const err = await server.cli.execWithEnv(`npm run create-move-file-storage-job -- --to-object-storage ${args}`, config)
            .then(() => undefined, err => err as Error)

          expect(err, args).to.exist
          expect(err.message).to.contain(`object_storage.${type}.enabled is false`)
        }

        await checkState()
      })

      it('Should move the files of a single video to object storage', async function () {
        this.timeout(120000)

        await runMove(`--to-object-storage -v ${uuids[0]}`)

        setVideoState(uuids[0], OS)
        await checkState()
      })

      it('Should only move the video files of the types enabled in object storage', async function () {
        this.timeout(120000)

        const config = buildConfig([ 'thumbnails' ])
        await restartWith(config)

        await runMove(`--to-object-storage -v ${uuids[1]}`, config)

        state.videos[uuids[1]].thumbnails = OS
        await checkState()

        await restartWith(buildConfig())
      })

      it('Should keep the video published while moving only its storyboard and torrents, with a missing torrent', async function () {
        this.timeout(120000)

        // The video files and thumbnails of this video are already in object storage
        const video = await server.videos.get({ id: uuids[1] })
        const torrentPath = join(server.servers.buildDirectory('torrents'), basename(video.files[0].torrentUrl))

        await move(torrentPath, torrentPath + '.bak')

        try {
          await server.jobs.pauseJobQueue()

          const command = `npm run create-move-file-storage-job -- --to-object-storage -v ${uuids[1]}`
          const { stdout } = await server.cli.execWithEnv(command, buildConfig())
          expect(stdout).to.include('thumbnails, torrents and storyboard')

          // The job is pending, but the video has not been taken out of its published state
          expect((await server.videos.get({ id: uuids[1] })).state.id).to.equal(VideoState.PUBLISHED)
        } finally {
          await server.jobs.resumeJobQueue()
        }

        await waitJobs([ server, remoteServer ])

        // The missing torrent has been skipped, without failing the move of the other files
        expect((await server.videos.get({ id: uuids[1] })).state.id).to.equal(VideoState.PUBLISHED)

        await move(torrentPath + '.bak', torrentPath)

        state.videos[uuids[1]].storyboards = OS
        await checkState()

        await runMove(`--to-object-storage -v ${uuids[1]}`)

        state.videos[uuids[1]].torrents = OS
        await checkState()
      })

      it('Should move actor images to object storage', async function () {
        this.timeout(120000)

        const { avatars: previousRemoteUrls } = await getRemoteUrls()

        await runMove('--to-object-storage --all-actor-images')

        state.actorImages = OS
        await checkState()

        await checkRemoteUrlsUpdated(previousRemoteUrls, (await getRemoteUrls()).avatars)
      })

      it('Should move playlist thumbnails to object storage', async function () {
        this.timeout(120000)

        const { playlistThumbnails: previousRemoteUrls } = await getRemoteUrls()

        await runMove('--to-object-storage --all-playlists')

        state.playlistThumbnails = OS
        await checkState()

        await checkRemoteUrlsUpdated(previousRemoteUrls, (await getRemoteUrls()).playlistThumbnails)
      })

      it('Should move uploads to object storage', async function () {
        this.timeout(120000)

        await runMove('--to-object-storage --all-uploads')

        state.uploads = OS
        await checkState()
      })

      describe('Back to the file system, with object storage disabled for these files', function () {
        const config = () => buildConfig([])

        before(async function () {
          this.timeout(120000)

          await restartWith(config())
        })

        it('Should move the files of a single video to the file system', async function () {
          this.timeout(120000)

          await runMove(`--to-file-system -v ${uuids[0]}`, config())

          setVideoState(uuids[0], FS)
          await checkState()
        })

        it('Should move actor images to the file system', async function () {
          this.timeout(120000)

          const { avatars: previousRemoteUrls } = await getRemoteUrls()

          await runMove('--to-file-system --all-actor-images', config())

          state.actorImages = FS
          await checkState()

          await checkRemoteUrlsUpdated(previousRemoteUrls, (await getRemoteUrls()).avatars)
        })

        it('Should move playlist thumbnails to the file system', async function () {
          this.timeout(120000)

          const { playlistThumbnails: previousRemoteUrls } = await getRemoteUrls()

          await runMove('--to-file-system --all-playlists', config())

          state.playlistThumbnails = FS
          await checkState()

          await checkRemoteUrlsUpdated(previousRemoteUrls, (await getRemoteUrls()).playlistThumbnails)
        })

        it('Should move uploads to the file system', async function () {
          this.timeout(120000)

          await runMove('--to-file-system --all-uploads', config())

          state.uploads = FS
          await checkState()
        })
      })
    })

    describe('Move everything', function () {
      before(async function () {
        this.timeout(120000)

        await restartWith(buildConfig())
      })

      it('Should skip the files that are not enabled in object storage when moving everything', async function () {
        this.timeout(240000)

        const config = buildConfig(allOptionalTypes.filter(t => t !== 'avatars'))
        await restartWith(config)

        const { stderr } = await server.cli.execWithEnv('npm run create-move-file-storage-job -- --to-object-storage --all', config)
        await waitJobs([ server, remoteServer ])

        expect(stderr).to.contain('object_storage.avatars.enabled is false, cannot move actor images to object storage. Skipping them.')

        for (const uuid of uuids) {
          setVideoState(uuid, OS)
        }

        state.playlistThumbnails = OS
        state.uploads = OS

        // Actor images stay on the file system
        await checkState()

        await restartWith(buildConfig())
      })

      it('Should move everything to object storage', async function () {
        this.timeout(240000)

        await runMove('--to-object-storage --all')

        for (const uuid of uuids) {
          setVideoState(uuid, OS)
        }

        state.actorImages = OS
        state.playlistThumbnails = OS
        state.uploads = OS

        await checkState()
      })

      it('Should not re-move the same files', async function () {
        this.timeout(120000)

        const stdout = await runMove('--to-object-storage --all')

        expect(stdout).to.not.include('Moving ')
      })

      it('Should move everything back to the file system', async function () {
        this.timeout(240000)

        // Torrent files are regenerated with a new filename when the video files move
        const oldTorrentObjectUrls: string[] = []
        for (const uuid of uuids) {
          const video = await server.videos.get({ id: uuid })

          oldTorrentObjectUrls.push(...video.files.map(f => f.torrentUrl))
        }

        await runMove('--to-file-system --all')

        for (const uuid of uuids) {
          setVideoState(uuid, FS)
        }

        state.actorImages = FS
        state.playlistThumbnails = FS
        state.uploads = FS

        await checkState()

        for (const url of oldTorrentObjectUrls) {
          await makeRawRequest({ url, expectedStatus: HttpStatusCode.NOT_FOUND_404 })
        }
      })
    })

    after(async function () {
      await objectStorage.cleanupMock()

      await cleanupTests([ server, remoteServer ])
    })
  })
})
