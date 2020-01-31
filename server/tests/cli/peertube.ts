/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { expect } from 'chai'
import {
  addVideoChannel,
  buildAbsoluteFixturePath,
  cleanupTests,
  createUser,
  doubleFollow,
  execCLI,
  flushAndRunServer,
  getEnvCli,
  getLocalIdByUUID,
  getVideo,
  getVideosList,
  removeVideo,
  ServerInfo,
  setAccessTokensToServers,
  uploadVideoAndGetId,
  userLogin,
  waitJobs
} from '../../../shared/extra-utils'
import { Video, VideoDetails } from '../../../shared'
import { getYoutubeVideoUrl } from '../../../shared/extra-utils/videos/video-imports'

describe('Test CLI wrapper', function () {
  let server: ServerInfo
  let userAccessToken: string

  const cmd = 'node ./dist/server/tools/peertube.js'

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    await createUser({ url: server.url, accessToken: server.accessToken, username: 'user_1', password: 'super_password' })

    userAccessToken = await userLogin(server, { username: 'user_1', password: 'super_password' })

    {
      const args = { name: 'user_channel', displayName: 'User channel', support: 'super support text' }
      await addVideoChannel(server.url, userAccessToken, args)
    }
  })

  describe('Authentication and instance selection', function () {

    it('Should display no selected instance', async function () {
      this.timeout(60000)

      const env = getEnvCli(server)
      const stdout = await execCLI(`${env} ${cmd} --help`)

      expect(stdout).to.contain('no instance selected')
    })

    it('Should add a user', async function () {
      this.timeout(60000)

      const env = getEnvCli(server)
      await execCLI(`${env} ${cmd} auth add -u ${server.url} -U user_1 -p super_password`)
    })

    it('Should default to this user', async function () {
      this.timeout(60000)

      const env = getEnvCli(server)
      const stdout = await execCLI(`${env} ${cmd} --help`)

      expect(stdout).to.contain(`instance ${server.url} selected`)
    })

    it('Should remember the user', async function () {
      this.timeout(60000)

      const env = getEnvCli(server)
      const stdout = await execCLI(`${env} ${cmd} auth list`)

      expect(stdout).to.contain(server.url)
    })
  })

  describe('Video upload/import', function () {

    it('Should upload a video', async function () {
      this.timeout(60000)

      const env = getEnvCli(server)

      const fixture = buildAbsoluteFixturePath('60fps_720p_small.mp4')

      const params = `-f ${fixture} --video-name 'test upload' --channel-name user_channel --support 'support_text'`

      await execCLI(`${env} ${cmd} upload ${params}`)
    })

    it('Should have the video uploaded', async function () {
      const res = await getVideosList(server.url)

      expect(res.body.total).to.equal(1)

      const videos: Video[] = res.body.data

      const video: VideoDetails = (await getVideo(server.url, videos[0].uuid)).body

      expect(video.name).to.equal('test upload')
      expect(video.support).to.equal('support_text')
      expect(video.channel.name).to.equal('user_channel')
    })

    it('Should import a video', async function () {
      this.timeout(60000)

      const env = getEnvCli(server)

      const params = `--target-url ${getYoutubeVideoUrl()} --channel-name user_channel`

      await execCLI(`${env} ${cmd} import ${params}`)
    })

    it('Should have imported the video', async function () {
      this.timeout(60000)

      await waitJobs([ server ])

      const res = await getVideosList(server.url)

      expect(res.body.total).to.equal(2)

      const videos: Video[] = res.body.data
      const video = videos.find(v => v.name === 'small video - youtube')
      expect(video).to.not.be.undefined

      const videoDetails: VideoDetails = (await getVideo(server.url, video.id)).body
      expect(videoDetails.channel.name).to.equal('user_channel')
      expect(videoDetails.support).to.equal('super support text')
      expect(videoDetails.nsfw).to.be.false

      // So we can reimport it
      await removeVideo(server.url, userAccessToken, video.id)
    })

    it('Should import and override some imported attributes', async function () {
      this.timeout(60000)

      const env = getEnvCli(server)

      const params = `--target-url ${getYoutubeVideoUrl()} --channel-name user_channel --video-name toto --nsfw --support support`

      await execCLI(`${env} ${cmd} import ${params}`)

      await waitJobs([ server ])

      {
        const res = await getVideosList(server.url)
        expect(res.body.total).to.equal(2)

        const videos: Video[] = res.body.data
        const video = videos.find(v => v.name === 'toto')
        expect(video).to.not.be.undefined

        const videoDetails: VideoDetails = (await getVideo(server.url, video.id)).body
        expect(videoDetails.channel.name).to.equal('user_channel')
        expect(videoDetails.support).to.equal('support')
        expect(videoDetails.nsfw).to.be.true
        expect(videoDetails.commentsEnabled).to.be.true
      }
    })
  })

  describe('Admin auth', function () {

    it('Should remove the auth user', async function () {
      const env = getEnvCli(server)

      await execCLI(`${env} ${cmd} auth del ${server.url}`)

      const stdout = await execCLI(`${env} ${cmd} --help`)

      expect(stdout).to.contain('no instance selected')
    })

    it('Should add the admin user', async function () {
      const env = getEnvCli(server)
      await execCLI(`${env} ${cmd} auth add -u ${server.url} -U root -p test${server.internalServerNumber}`)
    })
  })

  describe('Manage plugins', function () {

    it('Should install a plugin', async function () {
      this.timeout(60000)

      const env = getEnvCli(server)
      await execCLI(`${env} ${cmd} plugins install --npm-name peertube-plugin-hello-world`)
    })

    it('Should list installed plugins', async function () {
      const env = getEnvCli(server)
      const res = await execCLI(`${env} ${cmd} plugins list`)

      expect(res).to.contain('peertube-plugin-hello-world')
    })

    it('Should uninstall the plugin', async function () {
      const env = getEnvCli(server)
      const res = await execCLI(`${env} ${cmd} plugins uninstall --npm-name peertube-plugin-hello-world`)

      expect(res).to.not.contain('peertube-plugin-hello-world')
    })
  })

  describe('Manage video redundancies', function () {
    let anotherServer: ServerInfo
    let video1Server2: number
    let servers: ServerInfo[]

    before(async function () {
      this.timeout(120000)

      anotherServer = await flushAndRunServer(2)
      await setAccessTokensToServers([ anotherServer ])

      await doubleFollow(server, anotherServer)

      servers = [ server, anotherServer ]
      await waitJobs(servers)

      const uuid = (await uploadVideoAndGetId({ server: anotherServer, videoName: 'super video' })).uuid
      await waitJobs(servers)

      video1Server2 = await getLocalIdByUUID(server.url, uuid)
    })

    it('Should add a redundancy', async function () {
      this.timeout(60000)

      const env = getEnvCli(server)

      const params = `add --video ${video1Server2}`

      await execCLI(`${env} ${cmd} redundancy ${params}`)

      await waitJobs(servers)
    })

    it('Should list redundancies', async function () {
      this.timeout(60000)

      {
        const env = getEnvCli(server)

        const params = 'list-my-redundancies'
        const stdout = await execCLI(`${env} ${cmd} redundancy ${params}`)

        expect(stdout).to.contain('super video')
        expect(stdout).to.contain(`localhost:${server.port}`)
      }
    })

    it('Should remove a redundancy', async function () {
      this.timeout(60000)

      const env = getEnvCli(server)

      const params = `remove --video ${video1Server2}`

      await execCLI(`${env} ${cmd} redundancy ${params}`)

      await waitJobs(servers)

      {
        const env = getEnvCli(server)
        const params = 'list-my-redundancies'
        const stdout = await execCLI(`${env} ${cmd} redundancy ${params}`)

        expect(stdout).to.not.contain('super video')
      }
    })

    after(async function () {
      this.timeout(10000)

      await cleanupTests([ anotherServer ])
    })
  })

  after(async function () {
    this.timeout(10000)

    await cleanupTests([ server ])
  })
})
