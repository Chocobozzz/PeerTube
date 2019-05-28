/* tslint:disable:no-unused-expression */

import * as chai from 'chai'
import 'mocha'
import {
  addVideoChannel,
  addVideoInPlaylist,
  checkPlaylistFilesWereRemoved,
  cleanupTests,
  createUser,
  createVideoPlaylist,
  deleteVideoChannel,
  deleteVideoPlaylist,
  doubleFollow,
  doVideosExistInMyPlaylist,
  flushAndRunMultipleServers,
  getAccountPlaylistsList,
  getAccountPlaylistsListWithToken,
  getMyUserInformation,
  getPlaylistVideos,
  getVideoChannelPlaylistsList,
  getVideoPlaylist,
  getVideoPlaylistPrivacies,
  getVideoPlaylistsList,
  getVideoPlaylistWithToken,
  removeUser,
  removeVideoFromPlaylist,
  reorderVideosPlaylist,
  ServerInfo,
  setAccessTokensToServers,
  setDefaultVideoChannel,
  testImage,
  unfollow,
  updateVideoPlaylist,
  updateVideoPlaylistElement,
  uploadVideo,
  uploadVideoAndGetId,
  userLogin,
  waitJobs,
  generateUserAccessToken
} from '../../../../shared/extra-utils'
import { VideoPlaylistPrivacy } from '../../../../shared/models/videos/playlist/video-playlist-privacy.model'
import { VideoPlaylist } from '../../../../shared/models/videos/playlist/video-playlist.model'
import { Video } from '../../../../shared/models/videos'
import { VideoPlaylistType } from '../../../../shared/models/videos/playlist/video-playlist-type.model'
import { VideoExistInPlaylist } from '../../../../shared/models/videos/playlist/video-exist-in-playlist.model'
import { User } from '../../../../shared/models/users'

const expect = chai.expect

describe('Test video playlists', function () {
  let servers: ServerInfo[] = []

  let playlistServer2Id1: number
  let playlistServer2Id2: number
  let playlistServer2UUID2: number

  let playlistServer1Id: number
  let playlistServer1UUID: string

  let nsfwVideoServer1: number

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(3, { transcoding: { enabled: false } })

    // Get the access tokens
    await setAccessTokensToServers(servers)
    await setDefaultVideoChannel(servers)

    // Server 1 and server 2 follow each other
    await doubleFollow(servers[0], servers[1])
    // Server 1 and server 3 follow each other
    await doubleFollow(servers[0], servers[2])

    {
      const serverPromises: Promise<any>[][] = []

      for (const server of servers) {
        const videoPromises: Promise<any>[] = []

        for (let i = 0; i < 7; i++) {
          videoPromises.push(
            uploadVideo(server.url, server.accessToken, { name: `video ${i} server ${server.serverNumber}`, nsfw: false })
              .then(res => res.body.video)
          )
        }

        serverPromises.push(videoPromises)
      }

      servers[0].videos = await Promise.all(serverPromises[0])
      servers[1].videos = await Promise.all(serverPromises[1])
      servers[2].videos = await Promise.all(serverPromises[2])
    }

    nsfwVideoServer1 = (await uploadVideoAndGetId({ server: servers[ 0 ], videoName: 'NSFW video', nsfw: true })).id

    await waitJobs(servers)
  })

  it('Should list video playlist privacies', async function () {
    const res = await getVideoPlaylistPrivacies(servers[0].url)

    const privacies = res.body
    expect(Object.keys(privacies)).to.have.length.at.least(3)

    expect(privacies[3]).to.equal('Private')
  })

  it('Should list watch later playlist', async function () {
    const url = servers[ 0 ].url
    const accessToken = servers[ 0 ].accessToken

    {
      const res = await getAccountPlaylistsListWithToken(url, accessToken, 'root', 0, 5, VideoPlaylistType.WATCH_LATER)

      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.have.lengthOf(1)

      const playlist: VideoPlaylist = res.body.data[ 0 ]
      expect(playlist.displayName).to.equal('Watch later')
      expect(playlist.type.id).to.equal(VideoPlaylistType.WATCH_LATER)
      expect(playlist.type.label).to.equal('Watch later')
    }

    {
      const res = await getAccountPlaylistsListWithToken(url, accessToken, 'root', 0, 5, VideoPlaylistType.REGULAR)

      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.have.lengthOf(0)
    }

    {
      const res = await getAccountPlaylistsList(url, 'root', 0, 5)
      expect(res.body.total).to.equal(0)
      expect(res.body.data).to.have.lengthOf(0)
    }
  })

  it('Should get private playlist for a classic user', async function () {
    const token = await generateUserAccessToken(servers[0], 'toto')

    const res = await getAccountPlaylistsListWithToken(servers[0].url, token, 'toto', 0, 5)

    expect(res.body.total).to.equal(1)
    expect(res.body.data).to.have.lengthOf(1)

    const playlistId = res.body.data[0].id
    await getPlaylistVideos(servers[0].url, token, playlistId, 0, 5)
  })

  it('Should create a playlist on server 1 and have the playlist on server 2 and 3', async function () {
    this.timeout(30000)

    await createVideoPlaylist({
      url: servers[0].url,
      token: servers[0].accessToken,
      playlistAttrs: {
        displayName: 'my super playlist',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        description: 'my super description',
        thumbnailfile: 'thumbnail.jpg',
        videoChannelId: servers[0].videoChannel.id
      }
    })

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideoPlaylistsList(server.url, 0, 5)
      expect(res.body.total).to.equal(1)
      expect(res.body.data).to.have.lengthOf(1)

      const playlistFromList = res.body.data[0] as VideoPlaylist

      const res2 = await getVideoPlaylist(server.url, playlistFromList.uuid)
      const playlistFromGet = res2.body

      for (const playlist of [ playlistFromGet, playlistFromList ]) {
        expect(playlist.id).to.be.a('number')
        expect(playlist.uuid).to.be.a('string')

        expect(playlist.isLocal).to.equal(server.serverNumber === 1)

        expect(playlist.displayName).to.equal('my super playlist')
        expect(playlist.description).to.equal('my super description')
        expect(playlist.privacy.id).to.equal(VideoPlaylistPrivacy.PUBLIC)
        expect(playlist.privacy.label).to.equal('Public')
        expect(playlist.type.id).to.equal(VideoPlaylistType.REGULAR)
        expect(playlist.type.label).to.equal('Regular')

        expect(playlist.videosLength).to.equal(0)

        expect(playlist.ownerAccount.name).to.equal('root')
        expect(playlist.ownerAccount.displayName).to.equal('root')
        expect(playlist.videoChannel.name).to.equal('root_channel')
        expect(playlist.videoChannel.displayName).to.equal('Main root channel')
      }
    }
  })

  it('Should create a playlist on server 2 and have the playlist on server 1 but not on server 3', async function () {
    this.timeout(30000)

    {
      const res = await createVideoPlaylist({
        url: servers[1].url,
        token: servers[1].accessToken,
        playlistAttrs: {
          displayName: 'playlist 2',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          videoChannelId: servers[1].videoChannel.id
        }
      })
      playlistServer2Id1 = res.body.videoPlaylist.id
    }

    {
      const res = await createVideoPlaylist({
        url: servers[ 1 ].url,
        token: servers[ 1 ].accessToken,
        playlistAttrs: {
          displayName: 'playlist 3',
          privacy: VideoPlaylistPrivacy.PUBLIC,
          thumbnailfile: 'thumbnail.jpg',
          videoChannelId: servers[1].videoChannel.id
        }
      })

      playlistServer2Id2 = res.body.videoPlaylist.id
      playlistServer2UUID2 = res.body.videoPlaylist.uuid
    }

    for (let id of [ playlistServer2Id1, playlistServer2Id2 ]) {
      await addVideoInPlaylist({
        url: servers[ 1 ].url,
        token: servers[ 1 ].accessToken,
        playlistId: id,
        elementAttrs: { videoId: servers[ 1 ].videos[ 0 ].id, startTimestamp: 1, stopTimestamp: 2 }
      })
      await addVideoInPlaylist({
        url: servers[ 1 ].url,
        token: servers[ 1 ].accessToken,
        playlistId: id,
        elementAttrs: { videoId: servers[ 1 ].videos[ 1 ].id }
      })
    }

    await waitJobs(servers)

    for (const server of [ servers[0], servers[1] ]) {
      const res = await getVideoPlaylistsList(server.url, 0, 5)

      const playlist2 = res.body.data.find(p => p.displayName === 'playlist 2')
      expect(playlist2).to.not.be.undefined
      await testImage(server.url, 'thumbnail-playlist', playlist2.thumbnailPath)

      const playlist3 = res.body.data.find(p => p.displayName === 'playlist 3')
      expect(playlist3).to.not.be.undefined
      await testImage(server.url, 'thumbnail', playlist3.thumbnailPath)
    }

    const res = await getVideoPlaylistsList(servers[2].url, 0, 5)
    expect(res.body.data.find(p => p.displayName === 'playlist 2')).to.be.undefined
    expect(res.body.data.find(p => p.displayName === 'playlist 3')).to.be.undefined
  })

  it('Should have the playlist on server 3 after a new follow', async function () {
    this.timeout(30000)

    // Server 2 and server 3 follow each other
    await doubleFollow(servers[1], servers[2])

    const res = await getVideoPlaylistsList(servers[2].url, 0, 5)

    const playlist2 = res.body.data.find(p => p.displayName === 'playlist 2')
    expect(playlist2).to.not.be.undefined
    await testImage(servers[2].url, 'thumbnail-playlist', playlist2.thumbnailPath)

    expect(res.body.data.find(p => p.displayName === 'playlist 3')).to.not.be.undefined
  })

  it('Should correctly list the playlists', async function () {
    this.timeout(30000)

    {
      const res = await getVideoPlaylistsList(servers[ 2 ].url, 1, 2, 'createdAt')

      expect(res.body.total).to.equal(3)

      const data: VideoPlaylist[] = res.body.data
      expect(data).to.have.lengthOf(2)
      expect(data[ 0 ].displayName).to.equal('playlist 2')
      expect(data[ 1 ].displayName).to.equal('playlist 3')
    }

    {
      const res = await getVideoPlaylistsList(servers[ 2 ].url, 1, 2, '-createdAt')

      expect(res.body.total).to.equal(3)

      const data: VideoPlaylist[] = res.body.data
      expect(data).to.have.lengthOf(2)
      expect(data[ 0 ].displayName).to.equal('playlist 2')
      expect(data[ 1 ].displayName).to.equal('my super playlist')
    }
  })

  it('Should list video channel playlists', async function () {
    this.timeout(30000)

    {
      const res = await getVideoChannelPlaylistsList(servers[ 0 ].url, 'root_channel', 0, 2, '-createdAt')

      expect(res.body.total).to.equal(1)

      const data: VideoPlaylist[] = res.body.data
      expect(data).to.have.lengthOf(1)
      expect(data[ 0 ].displayName).to.equal('my super playlist')
    }
  })

  it('Should list account playlists', async function () {
    this.timeout(30000)

    {
      const res = await getAccountPlaylistsList(servers[ 1 ].url, 'root', 1, 2, '-createdAt')

      expect(res.body.total).to.equal(2)

      const data: VideoPlaylist[] = res.body.data
      expect(data).to.have.lengthOf(1)
      expect(data[ 0 ].displayName).to.equal('playlist 2')
    }

    {
      const res = await getAccountPlaylistsList(servers[ 1 ].url, 'root', 1, 2, 'createdAt')

      expect(res.body.total).to.equal(2)

      const data: VideoPlaylist[] = res.body.data
      expect(data).to.have.lengthOf(1)
      expect(data[ 0 ].displayName).to.equal('playlist 3')
    }
  })

  it('Should not list unlisted or private playlists', async function () {
    this.timeout(30000)

    await createVideoPlaylist({
      url: servers[ 1 ].url,
      token: servers[ 1 ].accessToken,
      playlistAttrs: {
        displayName: 'playlist unlisted',
        privacy: VideoPlaylistPrivacy.UNLISTED
      }
    })

    await createVideoPlaylist({
      url: servers[ 1 ].url,
      token: servers[ 1 ].accessToken,
      playlistAttrs: {
        displayName: 'playlist private',
        privacy: VideoPlaylistPrivacy.PRIVATE
      }
    })

    await waitJobs(servers)

    for (const server of servers) {
      const results = [
        await getAccountPlaylistsList(server.url, 'root@localhost:9002', 0, 5, '-createdAt'),
        await getVideoPlaylistsList(server.url, 0, 2, '-createdAt')
      ]

      expect(results[0].body.total).to.equal(2)
      expect(results[1].body.total).to.equal(3)

      for (const res of results) {
        const data: VideoPlaylist[] = res.body.data
        expect(data).to.have.lengthOf(2)
        expect(data[ 0 ].displayName).to.equal('playlist 3')
        expect(data[ 1 ].displayName).to.equal('playlist 2')
      }
    }
  })

  it('Should update a playlist', async function () {
    this.timeout(30000)

    await updateVideoPlaylist({
      url: servers[1].url,
      token: servers[1].accessToken,
      playlistAttrs: {
        displayName: 'playlist 3 updated',
        description: 'description updated',
        privacy: VideoPlaylistPrivacy.UNLISTED,
        thumbnailfile: 'thumbnail.jpg',
        videoChannelId: servers[1].videoChannel.id
      },
      playlistId: playlistServer2Id2
    })

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getVideoPlaylist(server.url, playlistServer2UUID2)
      const playlist: VideoPlaylist = res.body

      expect(playlist.displayName).to.equal('playlist 3 updated')
      expect(playlist.description).to.equal('description updated')

      expect(playlist.privacy.id).to.equal(VideoPlaylistPrivacy.UNLISTED)
      expect(playlist.privacy.label).to.equal('Unlisted')

      expect(playlist.type.id).to.equal(VideoPlaylistType.REGULAR)
      expect(playlist.type.label).to.equal('Regular')

      expect(playlist.videosLength).to.equal(2)

      expect(playlist.ownerAccount.name).to.equal('root')
      expect(playlist.ownerAccount.displayName).to.equal('root')
      expect(playlist.videoChannel.name).to.equal('root_channel')
      expect(playlist.videoChannel.displayName).to.equal('Main root channel')
    }
  })

  it('Should create a playlist containing different startTimestamp/endTimestamp videos', async function () {
    this.timeout(30000)

    const addVideo = (elementAttrs: any) => {
      return addVideoInPlaylist({ url: servers[0].url, token: servers[0].accessToken, playlistId: playlistServer1Id, elementAttrs })
    }

    const res = await createVideoPlaylist({
      url: servers[ 0 ].url,
      token: servers[ 0 ].accessToken,
      playlistAttrs: {
        displayName: 'playlist 4',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: servers[0].videoChannel.id
      }
    })

    playlistServer1Id = res.body.videoPlaylist.id
    playlistServer1UUID = res.body.videoPlaylist.uuid

    await addVideo({ videoId: servers[0].videos[0].uuid, startTimestamp: 15, stopTimestamp: 28 })
    await addVideo({ videoId: servers[2].videos[1].uuid, startTimestamp: 35 })
    await addVideo({ videoId: servers[2].videos[2].uuid })
    await addVideo({ videoId: servers[0].videos[3].uuid, stopTimestamp: 35 })
    await addVideo({ videoId: servers[0].videos[4].uuid, startTimestamp: 45, stopTimestamp: 60 })
    await addVideo({ videoId: nsfwVideoServer1, startTimestamp: 5 })

    await waitJobs(servers)
  })

  it('Should correctly list playlist videos', async function () {
    this.timeout(30000)

    for (const server of servers) {
      const res = await getPlaylistVideos(server.url, server.accessToken, playlistServer1UUID, 0, 10)

      expect(res.body.total).to.equal(6)

      const videos: Video[] = res.body.data
      expect(videos).to.have.lengthOf(6)

      expect(videos[0].name).to.equal('video 0 server 1')
      expect(videos[0].playlistElement.position).to.equal(1)
      expect(videos[0].playlistElement.startTimestamp).to.equal(15)
      expect(videos[0].playlistElement.stopTimestamp).to.equal(28)

      expect(videos[1].name).to.equal('video 1 server 3')
      expect(videos[1].playlistElement.position).to.equal(2)
      expect(videos[1].playlistElement.startTimestamp).to.equal(35)
      expect(videos[1].playlistElement.stopTimestamp).to.be.null

      expect(videos[2].name).to.equal('video 2 server 3')
      expect(videos[2].playlistElement.position).to.equal(3)
      expect(videos[2].playlistElement.startTimestamp).to.be.null
      expect(videos[2].playlistElement.stopTimestamp).to.be.null

      expect(videos[3].name).to.equal('video 3 server 1')
      expect(videos[3].playlistElement.position).to.equal(4)
      expect(videos[3].playlistElement.startTimestamp).to.be.null
      expect(videos[3].playlistElement.stopTimestamp).to.equal(35)

      expect(videos[4].name).to.equal('video 4 server 1')
      expect(videos[4].playlistElement.position).to.equal(5)
      expect(videos[4].playlistElement.startTimestamp).to.equal(45)
      expect(videos[4].playlistElement.stopTimestamp).to.equal(60)

      expect(videos[5].name).to.equal('NSFW video')
      expect(videos[5].playlistElement.position).to.equal(6)
      expect(videos[5].playlistElement.startTimestamp).to.equal(5)
      expect(videos[5].playlistElement.stopTimestamp).to.be.null

      const res2 = await getPlaylistVideos(server.url, server.accessToken, playlistServer1UUID, 0, 10, { nsfw: false })
      expect(res2.body.total).to.equal(5)
      expect(res2.body.data.find(v => v.name === 'NSFW video')).to.be.undefined

      const res3 = await getPlaylistVideos(server.url, server.accessToken, playlistServer1UUID, 0, 2)
      expect(res3.body.data).to.have.lengthOf(2)
    }
  })

  it('Should reorder the playlist', async function () {
    this.timeout(30000)

    {
      await reorderVideosPlaylist({
        url: servers[ 0 ].url,
        token: servers[ 0 ].accessToken,
        playlistId: playlistServer1Id,
        elementAttrs: {
          startPosition: 2,
          insertAfterPosition: 3
        }
      })

      await waitJobs(servers)

      for (const server of servers) {
        const res = await getPlaylistVideos(server.url, server.accessToken, playlistServer1UUID, 0, 10)
        const names = res.body.data.map(v => v.name)

        expect(names).to.deep.equal([
          'video 0 server 1',
          'video 2 server 3',
          'video 1 server 3',
          'video 3 server 1',
          'video 4 server 1',
          'NSFW video'
        ])
      }
    }

    {
      await reorderVideosPlaylist({
        url: servers[0].url,
        token: servers[0].accessToken,
        playlistId: playlistServer1Id,
        elementAttrs: {
          startPosition: 1,
          reorderLength: 3,
          insertAfterPosition: 4
        }
      })

      await waitJobs(servers)

      for (const server of servers) {
        const res = await getPlaylistVideos(server.url, server.accessToken, playlistServer1UUID, 0, 10)
        const names = res.body.data.map(v => v.name)

        expect(names).to.deep.equal([
          'video 3 server 1',
          'video 0 server 1',
          'video 2 server 3',
          'video 1 server 3',
          'video 4 server 1',
          'NSFW video'
        ])
      }
    }

    {
      await reorderVideosPlaylist({
        url: servers[0].url,
        token: servers[0].accessToken,
        playlistId: playlistServer1Id,
        elementAttrs: {
          startPosition: 6,
          insertAfterPosition: 3
        }
      })

      await waitJobs(servers)

      for (const server of servers) {
        const res = await getPlaylistVideos(server.url, server.accessToken, playlistServer1UUID, 0, 10)
        const videos: Video[] = res.body.data

        const names = videos.map(v => v.name)

        expect(names).to.deep.equal([
          'video 3 server 1',
          'video 0 server 1',
          'video 2 server 3',
          'NSFW video',
          'video 1 server 3',
          'video 4 server 1'
        ])

        for (let i = 1; i <= videos.length; i++) {
          expect(videos[i - 1].playlistElement.position).to.equal(i)
        }
      }
    }
  })

  it('Should update startTimestamp/endTimestamp of some elements', async function () {
    this.timeout(30000)

    await updateVideoPlaylistElement({
      url: servers[0].url,
      token: servers[0].accessToken,
      playlistId: playlistServer1Id,
      videoId: servers[0].videos[3].uuid,
      elementAttrs: {
        startTimestamp: 1
      }
    })

    await updateVideoPlaylistElement({
      url: servers[0].url,
      token: servers[0].accessToken,
      playlistId: playlistServer1Id,
      videoId: servers[0].videos[4].uuid,
      elementAttrs: {
        stopTimestamp: null
      }
    })

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getPlaylistVideos(server.url, server.accessToken, playlistServer1UUID, 0, 10)
      const videos: Video[] = res.body.data

      expect(videos[0].name).to.equal('video 3 server 1')
      expect(videos[0].playlistElement.position).to.equal(1)
      expect(videos[0].playlistElement.startTimestamp).to.equal(1)
      expect(videos[0].playlistElement.stopTimestamp).to.equal(35)

      expect(videos[5].name).to.equal('video 4 server 1')
      expect(videos[5].playlistElement.position).to.equal(6)
      expect(videos[5].playlistElement.startTimestamp).to.equal(45)
      expect(videos[5].playlistElement.stopTimestamp).to.be.null
    }
  })

  it('Should check videos existence in my playlist', async function () {
    const videoIds = [
      servers[0].videos[0].id,
      42000,
      servers[0].videos[3].id,
      43000,
      servers[0].videos[4].id
    ]
    const res = await doVideosExistInMyPlaylist(servers[ 0 ].url, servers[ 0 ].accessToken, videoIds)
    const obj = res.body as VideoExistInPlaylist

    {
      const elem = obj[servers[0].videos[0].id]
      expect(elem).to.have.lengthOf(1)
      expect(elem[ 0 ].playlistId).to.equal(playlistServer1Id)
      expect(elem[ 0 ].startTimestamp).to.equal(15)
      expect(elem[ 0 ].stopTimestamp).to.equal(28)
    }

    {
      const elem = obj[servers[0].videos[3].id]
      expect(elem).to.have.lengthOf(1)
      expect(elem[ 0 ].playlistId).to.equal(playlistServer1Id)
      expect(elem[ 0 ].startTimestamp).to.equal(1)
      expect(elem[ 0 ].stopTimestamp).to.equal(35)
    }

    {
      const elem = obj[servers[0].videos[4].id]
      expect(elem).to.have.lengthOf(1)
      expect(elem[ 0 ].playlistId).to.equal(playlistServer1Id)
      expect(elem[ 0 ].startTimestamp).to.equal(45)
      expect(elem[ 0 ].stopTimestamp).to.equal(null)
    }

    expect(obj[42000]).to.have.lengthOf(0)
    expect(obj[43000]).to.have.lengthOf(0)
  })

  it('Should automatically update updatedAt field of playlists', async function () {
    const server = servers[1]
    const videoId = servers[1].videos[5].id

    async function getPlaylistNames () {
      const res = await getAccountPlaylistsListWithToken(server.url, server.accessToken, 'root', 0, 5, undefined, '-updatedAt')

      return (res.body.data as VideoPlaylist[]).map(p => p.displayName)
    }

    const elementAttrs = { videoId }
    await addVideoInPlaylist({ url: server.url, token: server.accessToken, playlistId: playlistServer2Id1, elementAttrs })
    await addVideoInPlaylist({ url: server.url, token: server.accessToken, playlistId: playlistServer2Id2, elementAttrs })

    const names1 = await getPlaylistNames()
    expect(names1[0]).to.equal('playlist 3 updated')
    expect(names1[1]).to.equal('playlist 2')

    await removeVideoFromPlaylist({ url: server.url, token: server.accessToken, playlistId: playlistServer2Id1, videoId })

    const names2 = await getPlaylistNames()
    expect(names2[0]).to.equal('playlist 2')
    expect(names2[1]).to.equal('playlist 3 updated')

    await removeVideoFromPlaylist({ url: server.url, token: server.accessToken, playlistId: playlistServer2Id2, videoId })

    const names3 = await getPlaylistNames()
    expect(names3[0]).to.equal('playlist 3 updated')
    expect(names3[1]).to.equal('playlist 2')
  })

  it('Should delete some elements', async function () {
    this.timeout(30000)

    await removeVideoFromPlaylist({
      url: servers[0].url,
      token: servers[0].accessToken,
      playlistId: playlistServer1Id,
      videoId: servers[0].videos[3].uuid
    })

    await removeVideoFromPlaylist({
      url: servers[0].url,
      token: servers[0].accessToken,
      playlistId: playlistServer1Id,
      videoId: nsfwVideoServer1
    })

    await waitJobs(servers)

    for (const server of servers) {
      const res = await getPlaylistVideos(server.url, server.accessToken, playlistServer1UUID, 0, 10)

      expect(res.body.total).to.equal(4)

      const videos: Video[] = res.body.data
      expect(videos).to.have.lengthOf(4)

      expect(videos[ 0 ].name).to.equal('video 0 server 1')
      expect(videos[ 0 ].playlistElement.position).to.equal(1)

      expect(videos[ 1 ].name).to.equal('video 2 server 3')
      expect(videos[ 1 ].playlistElement.position).to.equal(2)

      expect(videos[ 2 ].name).to.equal('video 1 server 3')
      expect(videos[ 2 ].playlistElement.position).to.equal(3)

      expect(videos[ 3 ].name).to.equal('video 4 server 1')
      expect(videos[ 3 ].playlistElement.position).to.equal(4)
    }
  })

  it('Should delete the playlist on server 1 and delete on server 2 and 3', async function () {
    this.timeout(30000)

    await deleteVideoPlaylist(servers[0].url, servers[0].accessToken, playlistServer1Id)

    await waitJobs(servers)

    for (const server of servers) {
      await getVideoPlaylist(server.url, playlistServer1UUID, 404)
    }
  })

  it('Should have deleted the thumbnail on server 1, 2 and 3', async function () {
    this.timeout(30000)

    for (const server of servers) {
      await checkPlaylistFilesWereRemoved(playlistServer1UUID, server.serverNumber)
    }
  })

  it('Should unfollow servers 1 and 2 and hide their playlists', async function () {
    this.timeout(30000)

    const finder = data => data.find(p => p.displayName === 'my super playlist')

    {
      const res = await getVideoPlaylistsList(servers[ 2 ].url, 0, 5)
      expect(res.body.total).to.equal(2)
      expect(finder(res.body.data)).to.not.be.undefined
    }

    await unfollow(servers[2].url, servers[2].accessToken, servers[0])

    {
      const res = await getVideoPlaylistsList(servers[ 2 ].url, 0, 5)
      expect(res.body.total).to.equal(1)

      expect(finder(res.body.data)).to.be.undefined
    }
  })

  it('Should delete a channel and put the associated playlist in private mode', async function () {
    this.timeout(30000)

    const res = await addVideoChannel(servers[0].url, servers[0].accessToken, { name: 'super_channel', displayName: 'super channel' })
    const videoChannelId = res.body.videoChannel.id

    const res2 = await createVideoPlaylist({
      url: servers[0].url,
      token: servers[0].accessToken,
      playlistAttrs: {
        displayName: 'channel playlist',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId
      }
    })
    const videoPlaylistUUID = res2.body.videoPlaylist.uuid

    await waitJobs(servers)

    await deleteVideoChannel(servers[0].url, servers[0].accessToken, 'super_channel')

    await waitJobs(servers)

    const res3 = await getVideoPlaylistWithToken(servers[0].url, servers[0].accessToken, videoPlaylistUUID)
    expect(res3.body.displayName).to.equal('channel playlist')
    expect(res3.body.privacy.id).to.equal(VideoPlaylistPrivacy.PRIVATE)

    await getVideoPlaylist(servers[1].url, videoPlaylistUUID, 404)
  })

  it('Should delete an account and delete its playlists', async function () {
    this.timeout(30000)

    const user = { username: 'user_1', password: 'password' }
    const res = await createUser({
      url: servers[ 0 ].url,
      accessToken: servers[ 0 ].accessToken,
      username: user.username,
      password: user.password
    })

    const userId = res.body.user.id
    const userAccessToken = await userLogin(servers[0], user)

    const resChannel = await getMyUserInformation(servers[0].url, userAccessToken)
    const userChannel = (resChannel.body as User).videoChannels[0]

    await createVideoPlaylist({
      url: servers[0].url,
      token: userAccessToken,
      playlistAttrs: {
        displayName: 'playlist to be deleted',
        privacy: VideoPlaylistPrivacy.PUBLIC,
        videoChannelId: userChannel.id
      }
    })

    await waitJobs(servers)

    const finder = data => data.find(p => p.displayName === 'playlist to be deleted')

    {
      for (const server of [ servers[0], servers[1] ]) {
        const res = await getVideoPlaylistsList(server.url, 0, 15)
        expect(finder(res.body.data)).to.not.be.undefined
      }
    }

    await removeUser(servers[0].url, userId, servers[0].accessToken)
    await waitJobs(servers)

    {
      for (const server of [ servers[0], servers[1] ]) {
        const res = await getVideoPlaylistsList(server.url, 0, 15)
        expect(finder(res.body.data)).to.be.undefined
      }
    }
  })

  after(async function () {
    await cleanupTests(servers)
  })
})
