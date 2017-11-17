/* tslint:disable:no-unused-expression */

import 'mocha'
import * as chai from 'chai'

import {
  dateIsValid,
  flushAndRunMultipleServers,
  flushTests,
  getVideo,
  getVideosList,
  killallServers,
  makeFriends,
  rateVideo,
  removeVideo,
  ServerInfo,
  setAccessTokensToServers,
  testVideoImage,
  updateVideo,
  uploadVideo,
  wait,
  webtorrentAdd,
  addVideoChannel,
  getVideoChannelsList,
  getUserAccessToken
} from '../utils'
import { createUser } from '../utils/users'

const expect = chai.expect

describe('Test multiple pods', function () {
  let servers: ServerInfo[] = []
  const toRemove = []
  let videoUUID = ''
  let videoChannelId: number

  before(async function () {
    this.timeout(120000)

    servers = await flushAndRunMultipleServers(3)

    // Get the access tokens
    await setAccessTokensToServers(servers)

    const videoChannel = {
      name: 'my channel',
      description: 'super channel'
    }
    await addVideoChannel(servers[0].url, servers[0].accessToken, videoChannel)
    const channelRes = await getVideoChannelsList(servers[0].url, 0, 1)
    videoChannelId = channelRes.body.data[0].id

    // The second pod make friend with the third
    await makeFriends(servers[1].url, servers[1].accessToken)

    // Wait for the request between pods
    await wait(10000)

    // Pod 1 make friends too
    await makeFriends(servers[0].url, servers[0].accessToken)
  })

  it('Should not have videos for all pods', async function () {
    for (const server of servers) {
      const res = await getVideosList(server.url)
      const videos = res.body.data
      expect(videos).to.be.an('array')
      expect(videos.length).to.equal(0)
    }
  })

  describe('Should upload the video and propagate on each pod', function () {
    it('Should upload the video on pod 1 and propagate on each pod', async function () {
      // Pod 1 has video transcoding activated
      this.timeout(15000)

      const videoAttributes = {
        name: 'my super name for pod 1',
        category: 5,
        licence: 4,
        language: 9,
        nsfw: true,
        description: 'my super description for pod 1',
        tags: [ 'tag1p1', 'tag2p1' ],
        channelId: videoChannelId,
        fixture: 'video_short1.webm'
      }
      await uploadVideo(servers[0].url, servers[0].accessToken, videoAttributes)

      await wait(11000)

      // All pods should have this video
      for (const server of servers) {
        let baseMagnet = null

        const res = await getVideosList(server.url)

        const videos = res.body.data
        expect(videos).to.be.an('array')
        expect(videos.length).to.equal(1)
        const video = videos[0]
        expect(video.name).to.equal('my super name for pod 1')
        expect(video.category).to.equal(5)
        expect(video.categoryLabel).to.equal('Sports')
        expect(video.licence).to.equal(4)
        expect(video.licenceLabel).to.equal('Attribution - Non Commercial')
        expect(video.language).to.equal(9)
        expect(video.languageLabel).to.equal('Japanese')
        expect(video.nsfw).to.be.ok
        expect(video.description).to.equal('my super description for pod 1')
        expect(video.podHost).to.equal('localhost:9001')
        expect(video.duration).to.equal(10)
        expect(video.tags).to.deep.equal([ 'tag1p1', 'tag2p1' ])
        expect(dateIsValid(video.createdAt)).to.be.true
        expect(dateIsValid(video.updatedAt)).to.be.true
        expect(video.account).to.equal('root')

        const res2 = await getVideo(server.url, video.uuid)
        const videoDetails = res2.body

        expect(videoDetails.channel.name).to.equal('my channel')
        expect(videoDetails.channel.description).to.equal('super channel')
        expect(dateIsValid(videoDetails.channel.createdAt)).to.be.true
        expect(dateIsValid(videoDetails.channel.updatedAt)).to.be.true
        expect(videoDetails.files).to.have.lengthOf(1)

        const file = videoDetails.files[0]
        const magnetUri = file.magnetUri
        expect(file.magnetUri).to.have.lengthOf.above(2)
        expect(file.torrentUrl).to.equal(`http://${videoDetails.podHost}/static/torrents/${videoDetails.uuid}-${file.resolution}.torrent`)
        expect(file.fileUrl).to.equal(`http://${videoDetails.podHost}/static/webseed/${videoDetails.uuid}-${file.resolution}.webm`)
        expect(file.resolution).to.equal(720)
        expect(file.resolutionLabel).to.equal('720p')
        expect(file.size).to.equal(572456)

        if (server.url !== 'http://localhost:9001') {
          expect(video.isLocal).to.be.false
          expect(videoDetails.channel.isLocal).to.be.false
        } else {
          expect(video.isLocal).to.be.true
          expect(videoDetails.channel.isLocal).to.be.true
        }

        // All pods should have the same magnet Uri
        if (baseMagnet === null) {
          baseMagnet = magnetUri
        } else {
          expect(baseMagnet).to.equal(magnetUri)
        }

        const test = await testVideoImage(server.url, 'video_short1.webm', video.thumbnailPath)
        expect(test).to.equal(true)
      }
    })

    it('Should upload the video on pod 2 and propagate on each pod', async function () {
      this.timeout(120000)

      const user = {
        username: 'user1',
        password: 'super_password'
      }
      await createUser(servers[1].url, servers[1].accessToken, user.username, user.password)
      const userAccessToken = await getUserAccessToken(servers[1], user)

      const videoAttributes = {
        name: 'my super name for pod 2',
        category: 4,
        licence: 3,
        language: 11,
        nsfw: true,
        description: 'my super description for pod 2',
        tags: [ 'tag1p2', 'tag2p2', 'tag3p2' ],
        fixture: 'video_short2.webm'
      }
      await uploadVideo(servers[1].url, userAccessToken, videoAttributes)

      // Transcoding, so wait more than 22000
      await wait(60000)

      // All pods should have this video
      for (const server of servers) {
        let baseMagnet = {}

        const res = await getVideosList(server.url)

        const videos = res.body.data
        expect(videos).to.be.an('array')
        expect(videos.length).to.equal(2)
        const video = videos[1]
        expect(video.name).to.equal('my super name for pod 2')
        expect(video.category).to.equal(4)
        expect(video.categoryLabel).to.equal('Art')
        expect(video.licence).to.equal(3)
        expect(video.licenceLabel).to.equal('Attribution - No Derivatives')
        expect(video.language).to.equal(11)
        expect(video.languageLabel).to.equal('German')
        expect(video.nsfw).to.be.true
        expect(video.description).to.equal('my super description for pod 2')
        expect(video.podHost).to.equal('localhost:9002')
        expect(video.duration).to.equal(5)
        expect(video.tags).to.deep.equal([ 'tag1p2', 'tag2p2', 'tag3p2' ])
        expect(dateIsValid(video.createdAt)).to.be.true
        expect(dateIsValid(video.updatedAt)).to.be.true
        expect(video.account).to.equal('user1')

        if (server.url !== 'http://localhost:9002') {
          expect(video.isLocal).to.be.false
        } else {
          expect(video.isLocal).to.be.true
        }

        const res2 = await getVideo(server.url, video.uuid)
        const videoDetails = res2.body

        expect(videoDetails.channel.name).to.equal('Default user1 channel')
        expect(dateIsValid(videoDetails.channel.createdAt)).to.be.true
        expect(dateIsValid(videoDetails.channel.updatedAt)).to.be.true

        expect(videoDetails.files).to.have.lengthOf(4)

        // Check common attributes
        for (const file of videoDetails.files) {
          expect(file.magnetUri).to.have.lengthOf.above(2)

          // All pods should have the same magnet Uri
          if (baseMagnet[file.resolution] === undefined) {
            baseMagnet[file.resolution] = file.magnet
          } else {
            expect(baseMagnet[file.resolution]).to.equal(file.magnet)
          }
        }

        const file240p = videoDetails.files.find(f => f.resolution === 240)
        expect(file240p).not.to.be.undefined
        expect(file240p.resolutionLabel).to.equal('240p')
        expect(file240p.size).to.be.above(180000).and.below(200000)

        const file360p = videoDetails.files.find(f => f.resolution === 360)
        expect(file360p).not.to.be.undefined
        expect(file360p.resolutionLabel).to.equal('360p')
        expect(file360p.size).to.be.above(270000).and.below(290000)

        const file480p = videoDetails.files.find(f => f.resolution === 480)
        expect(file480p).not.to.be.undefined
        expect(file480p.resolutionLabel).to.equal('480p')
        expect(file480p.size).to.be.above(380000).and.below(400000)

        const file720p = videoDetails.files.find(f => f.resolution === 720)
        expect(file720p).not.to.be.undefined
        expect(file720p.resolutionLabel).to.equal('720p')
        expect(file720p.size).to.be.above(700000).and.below(7200000)

        const test = await testVideoImage(server.url, 'video_short2.webm', videoDetails.thumbnailPath)
        expect(test).to.equal(true)
      }
    })

    it('Should upload two videos on pod 3 and propagate on each pod', async function () {
      this.timeout(45000)

      const videoAttributes1 = {
        name: 'my super name for pod 3',
        category: 6,
        licence: 5,
        language: 11,
        nsfw: true,
        description: 'my super description for pod 3',
        tags: [ 'tag1p3' ],
        fixture: 'video_short3.webm'
      }
      await uploadVideo(servers[2].url, servers[2].accessToken, videoAttributes1)

      const videoAttributes2 = {
        name: 'my super name for pod 3-2',
        category: 7,
        licence: 6,
        language: 12,
        nsfw: false,
        description: 'my super description for pod 3-2',
        tags: [ 'tag2p3', 'tag3p3', 'tag4p3' ],
        fixture: 'video_short.webm'
      }
      await uploadVideo(servers[2].url, servers[2].accessToken, videoAttributes2)

      await wait(33000)

      let baseMagnet = null
      // All pods should have this video
      for (const server of servers) {
        const res = await getVideosList(server.url)

        const videos = res.body.data
        expect(videos).to.be.an('array')
        expect(videos.length).to.equal(4)

        // We not sure about the order of the two last uploads
        let video1 = null
        let video2 = null
        if (videos[2].name === 'my super name for pod 3') {
          video1 = videos[2]
          video2 = videos[3]
        } else {
          video1 = videos[3]
          video2 = videos[2]
        }

        expect(video1.name).to.equal('my super name for pod 3')
        expect(video1.category).to.equal(6)
        expect(video1.categoryLabel).to.equal('Travels')
        expect(video1.licence).to.equal(5)
        expect(video1.licenceLabel).to.equal('Attribution - Non Commercial - Share Alike')
        expect(video1.language).to.equal(11)
        expect(video1.languageLabel).to.equal('German')
        expect(video1.nsfw).to.be.ok
        expect(video1.description).to.equal('my super description for pod 3')
        expect(video1.podHost).to.equal('localhost:9003')
        expect(video1.duration).to.equal(5)
        expect(video1.tags).to.deep.equal([ 'tag1p3' ])
        expect(video1.author).to.equal('root')
        expect(dateIsValid(video1.createdAt)).to.be.true
        expect(dateIsValid(video1.updatedAt)).to.be.true

        const res2 = await getVideo(server.url, video1.id)
        const video1Details = res2.body
        expect(video1Details.files).to.have.lengthOf(1)

        const file1 = video1Details.files[0]
        expect(file1.magnetUri).to.have.lengthOf.above(2)
        expect(file1.resolution).to.equal(720)
        expect(file1.resolutionLabel).to.equal('720p')
        expect(file1.size).to.equal(292677)

        expect(video2.name).to.equal('my super name for pod 3-2')
        expect(video2.category).to.equal(7)
        expect(video2.categoryLabel).to.equal('Gaming')
        expect(video2.licence).to.equal(6)
        expect(video2.licenceLabel).to.equal('Attribution - Non Commercial - No Derivatives')
        expect(video2.language).to.equal(12)
        expect(video2.languageLabel).to.equal('Korean')
        expect(video2.nsfw).to.be.false
        expect(video2.description).to.equal('my super description for pod 3-2')
        expect(video2.podHost).to.equal('localhost:9003')
        expect(video2.duration).to.equal(5)
        expect(video2.tags).to.deep.equal([ 'tag2p3', 'tag3p3', 'tag4p3' ])
        expect(video2.author).to.equal('root')
        expect(dateIsValid(video2.createdAt)).to.be.true
        expect(dateIsValid(video2.updatedAt)).to.be.true

        const res3 = await getVideo(server.url, video2.id)
        const video2Details = res3.body

        expect(video2Details.files).to.have.lengthOf(1)

        const file2 = video2Details.files[0]
        const magnetUri2 = file2.magnetUri
        expect(file2.magnetUri).to.have.lengthOf.above(2)
        expect(file2.resolution).to.equal(720)
        expect(file2.resolutionLabel).to.equal('720p')
        expect(file2.size).to.equal(218910)

        if (server.url !== 'http://localhost:9003') {
          expect(video1.isLocal).to.be.false
          expect(video2.isLocal).to.be.false
        } else {
          expect(video1.isLocal).to.be.true
          expect(video2.isLocal).to.be.true
        }

        // All pods should have the same magnet Uri
        if (baseMagnet === null) {
          baseMagnet = magnetUri2
        } else {
          expect(baseMagnet).to.equal(magnetUri2)
        }

        const test1 = await testVideoImage(server.url, 'video_short3.webm', video1.thumbnailPath)
        expect(test1).to.equal(true)

        const test2 = await testVideoImage(server.url, 'video_short.webm', video2.thumbnailPath)
        expect(test2).to.equal(true)
      }
    })
  })

  describe('Should seed the uploaded video', function () {
    it('Should add the file 1 by asking pod 3', async function () {
      // Yes, this could be long
      this.timeout(200000)

      const res = await getVideosList(servers[2].url)

      const video = res.body.data[0]
      toRemove.push(res.body.data[2])
      toRemove.push(res.body.data[3])

      const res2 = await getVideo(servers[2].url, video.id)
      const videoDetails = res2.body

      const torrent = await webtorrentAdd(videoDetails.files[0].magnetUri)
      expect(torrent.files).to.be.an('array')
      expect(torrent.files.length).to.equal(1)
      expect(torrent.files[0].path).to.exist.and.to.not.equal('')
    })

    it('Should add the file 2 by asking pod 1', async function () {
      // Yes, this could be long
      this.timeout(200000)

      const res = await getVideosList(servers[0].url)

      const video = res.body.data[1]
      const res2 = await getVideo(servers[0].url, video.id)
      const videoDetails = res2.body

      const torrent = await webtorrentAdd(videoDetails.files[0].magnetUri)
      expect(torrent.files).to.be.an('array')
      expect(torrent.files.length).to.equal(1)
      expect(torrent.files[0].path).to.exist.and.to.not.equal('')
    })

    it('Should add the file 3 by asking pod 2', async function () {
      // Yes, this could be long
      this.timeout(200000)

      const res = await getVideosList(servers[1].url)

      const video = res.body.data[2]
      const res2 = await getVideo(servers[1].url, video.id)
      const videoDetails = res2.body

      const torrent = await webtorrentAdd(videoDetails.files[0].magnetUri)
      expect(torrent.files).to.be.an('array')
      expect(torrent.files.length).to.equal(1)
      expect(torrent.files[0].path).to.exist.and.to.not.equal('')
    })

    it('Should add the file 3-2 by asking pod 1', async function () {
      // Yes, this could be long
      this.timeout(200000)

      const res = await getVideosList(servers[0].url)

      const video = res.body.data[3]
      const res2 = await getVideo(servers[0].url, video.id)
      const videoDetails = res2.body

      const torrent = await webtorrentAdd(videoDetails.files[0].magnetUri)
      expect(torrent.files).to.be.an('array')
      expect(torrent.files.length).to.equal(1)
      expect(torrent.files[0].path).to.exist.and.to.not.equal('')
    })

    it('Should add the file 2 in 360p by asking pod 1', async function () {
      // Yes, this could be long
      this.timeout(200000)

      const res = await getVideosList(servers[0].url)

      const video = res.body.data.find(v => v.name === 'my super name for pod 2')
      const res2 = await getVideo(servers[0].url, video.id)
      const videoDetails = res2.body

      const file = videoDetails.files.find(f => f.resolution === 360)
      expect(file).not.to.be.undefined

      const torrent = await webtorrentAdd(file.magnetUri)
      expect(torrent.files).to.be.an('array')
      expect(torrent.files.length).to.equal(1)
      expect(torrent.files[0].path).to.exist.and.to.not.equal('')
    })
  })

  describe('Should update video views, likes and dislikes', function () {
    let localVideosPod3 = []
    let remoteVideosPod1 = []
    let remoteVideosPod2 = []
    let remoteVideosPod3 = []

    before(async function () {
      const res1 = await getVideosList(servers[0].url)
      remoteVideosPod1 = res1.body.data.filter(video => video.isLocal === false).map(video => video.uuid)

      const res2 = await getVideosList(servers[1].url)
      remoteVideosPod2 = res2.body.data.filter(video => video.isLocal === false).map(video => video.uuid)

      const res3 = await getVideosList(servers[2].url)
      localVideosPod3 = res3.body.data.filter(video => video.isLocal === true).map(video => video.uuid)
      remoteVideosPod3 = res3.body.data.filter(video => video.isLocal === false).map(video => video.uuid)
    })

    it('Should view multiple videos on owned servers', async function () {
      this.timeout(30000)

      const tasks: Promise<any>[] = []
      tasks.push(getVideo(servers[2].url, localVideosPod3[0]))
      tasks.push(getVideo(servers[2].url, localVideosPod3[0]))
      tasks.push(getVideo(servers[2].url, localVideosPod3[0]))
      tasks.push(getVideo(servers[2].url, localVideosPod3[1]))

      await Promise.all(tasks)

      await wait(22000)

      for (const server of servers) {
        const res = await getVideosList(server.url)

        const videos = res.body.data
        const video0 = videos.find(v => v.uuid === localVideosPod3[0])
        const video1 = videos.find(v => v.uuid === localVideosPod3[1])

        expect(video0.views).to.equal(7)
        expect(video1.views).to.equal(5)
      }
    })

    it('Should view multiple videos on each servers', async function () {
      this.timeout(30000)

      const tasks: Promise<any>[] = []
      tasks.push(getVideo(servers[0].url, remoteVideosPod1[0]))
      tasks.push(getVideo(servers[1].url, remoteVideosPod2[0]))
      tasks.push(getVideo(servers[1].url, remoteVideosPod2[0]))
      tasks.push(getVideo(servers[2].url, remoteVideosPod3[0]))
      tasks.push(getVideo(servers[2].url, remoteVideosPod3[1]))
      tasks.push(getVideo(servers[2].url, remoteVideosPod3[1]))
      tasks.push(getVideo(servers[2].url, remoteVideosPod3[1]))
      tasks.push(getVideo(servers[2].url, localVideosPod3[1]))
      tasks.push(getVideo(servers[2].url, localVideosPod3[1]))
      tasks.push(getVideo(servers[2].url, localVideosPod3[1]))

      await Promise.all(tasks)

      await wait(22000)

      let baseVideos = null

      for (const server of servers) {
        const res = await getVideosList(server.url)

        const videos = res.body.data

        // Initialize base videos for future comparisons
        if (baseVideos === null) {
          baseVideos = videos
          return
        }

        for (const baseVideo of baseVideos) {
          const sameVideo = videos.find(video => video.name === baseVideo.name)
          expect(baseVideo.views).to.equal(sameVideo.views)
        }
      }
    })

    it('Should like and dislikes videos on different services', async function () {
      this.timeout(30000)

      const tasks: Promise<any>[] = []
      tasks.push(rateVideo(servers[0].url, servers[0].accessToken, remoteVideosPod1[0], 'like'))
      tasks.push(rateVideo(servers[0].url, servers[0].accessToken, remoteVideosPod1[0], 'dislike'))
      tasks.push(rateVideo(servers[0].url, servers[0].accessToken, remoteVideosPod1[0], 'like'))
      tasks.push(rateVideo(servers[2].url, servers[2].accessToken, localVideosPod3[1], 'like'))
      tasks.push(rateVideo(servers[2].url, servers[2].accessToken, localVideosPod3[1], 'dislike'))
      tasks.push(rateVideo(servers[2].url, servers[2].accessToken, remoteVideosPod3[1], 'dislike'))
      tasks.push(rateVideo(servers[2].url, servers[2].accessToken, remoteVideosPod3[0], 'like'))

      await Promise.all(tasks)

      await wait(22000)

      let baseVideos = null
      for (const server of servers) {
        const res = await getVideosList(server.url)

        const videos = res.body.data

        // Initialize base videos for future comparisons
        if (baseVideos === null) {
          baseVideos = videos
          return
        }

        baseVideos.forEach(baseVideo => {
          const sameVideo = videos.find(video => video.name === baseVideo.name)
          expect(baseVideo.likes).to.equal(sameVideo.likes)
          expect(baseVideo.dislikes).to.equal(sameVideo.dislikes)
        })
      }
    })
  })

  describe('Should manipulate these videos', function () {
    it('Should update the video 3 by asking pod 3', async function () {
      this.timeout(15000)

      const attributes = {
        name: 'my super video updated',
        category: 10,
        licence: 7,
        language: 13,
        nsfw: true,
        description: 'my super description updated',
        tags: [ 'tag_up_1', 'tag_up_2' ]
      }

      await updateVideo(servers[2].url, servers[2].accessToken, toRemove[0].id, attributes)

      await wait(11000)
    })

    it('Should have the video 3 updated on each pod', async function () {
      this.timeout(200000)

      for (const server of servers) {
        const res = await getVideosList(server.url)

        const videos = res.body.data
        const videoUpdated = videos.find(video => video.name === 'my super video updated')

        expect(!!videoUpdated).to.be.true
        expect(videoUpdated.category).to.equal(10)
        expect(videoUpdated.categoryLabel).to.equal('Entertainment')
        expect(videoUpdated.licence).to.equal(7)
        expect(videoUpdated.licenceLabel).to.equal('Public Domain Dedication')
        expect(videoUpdated.language).to.equal(13)
        expect(videoUpdated.languageLabel).to.equal('French')
        expect(videoUpdated.nsfw).to.be.ok
        expect(videoUpdated.description).to.equal('my super description updated')
        expect(videoUpdated.tags).to.deep.equal([ 'tag_up_1', 'tag_up_2' ])
        expect(dateIsValid(videoUpdated.updatedAt, 20000)).to.be.true

        const res2 = await getVideo(server.url, videoUpdated.uuid)
        const videoUpdatedDetails = res2.body

        const file = videoUpdatedDetails .files[0]
        expect(file.magnetUri).to.have.lengthOf.above(2)
        expect(file.resolution).to.equal(720)
        expect(file.resolutionLabel).to.equal('720p')
        expect(file.size).to.equal(292677)

        const test = await testVideoImage(server.url, 'video_short3.webm', videoUpdated.thumbnailPath)
        expect(test).to.equal(true)

        // Avoid "duplicate torrent" errors
        const refreshWebTorrent = true
        const torrent = await webtorrentAdd(videoUpdatedDetails .files[0].magnetUri, refreshWebTorrent)
        expect(torrent.files).to.be.an('array')
        expect(torrent.files.length).to.equal(1)
        expect(torrent.files[0].path).to.exist.and.to.not.equal('')
      }
    })

    it('Should remove the videos 3 and 3-2 by asking pod 3', async function () {
      this.timeout(15000)

      await removeVideo(servers[2].url, servers[2].accessToken, toRemove[0].id)
      await removeVideo(servers[2].url, servers[2].accessToken, toRemove[1].id)

      await wait(11000)
    })

    it('Should have videos 1 and 3 on each pod', async function () {
      for (const server of servers) {
        const res = await getVideosList(server.url)

        const videos = res.body.data
        expect(videos).to.be.an('array')
        expect(videos.length).to.equal(2)
        expect(videos[0].name).not.to.equal(videos[1].name)
        expect(videos[0].name).not.to.equal(toRemove[0].name)
        expect(videos[1].name).not.to.equal(toRemove[0].name)
        expect(videos[0].name).not.to.equal(toRemove[1].name)
        expect(videos[1].name).not.to.equal(toRemove[1].name)

        videoUUID = videos.find(video => video.name === 'my super name for pod 1').uuid
      }
    })

    it('Should get the same video by UUID on each pod', async function () {
      let baseVideo = null
      for (const server of servers) {
        const res = await getVideo(server.url, videoUUID)

        const video = res.body

        if (baseVideo === null) {
          baseVideo = video
          return
        }

        expect(baseVideo.name).to.equal(video.name)
        expect(baseVideo.uuid).to.equal(video.uuid)
        expect(baseVideo.category).to.equal(video.category)
        expect(baseVideo.language).to.equal(video.language)
        expect(baseVideo.licence).to.equal(video.licence)
        expect(baseVideo.category).to.equal(video.category)
        expect(baseVideo.nsfw).to.equal(video.nsfw)
        expect(baseVideo.author).to.equal(video.account)
        expect(baseVideo.tags).to.deep.equal(video.tags)
      }
    })

    it('Should get the preview from each pod', async function () {
      for (const server of servers) {
        const res = await getVideo(server.url, videoUUID)
        const video = res.body

        const test = await testVideoImage(server.url, 'video_short1-preview.webm', video.previewPath)
        expect(test).to.equal(true)
      }
    })
  })

  after(async function () {
    killallServers(servers)

    // Keep the logs if the test failed
    if (this['ok']) {
      await flushTests()
    }
  })
})
