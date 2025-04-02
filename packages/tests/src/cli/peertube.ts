/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import {
  cleanupTests,
  CLICommand,
  createSingleServer,
  doubleFollow,
  PeerTubeServer,
  setAccessTokensToServers,
  waitJobs
} from '@peertube/peertube-server-commands'
import { testHelloWorldRegisteredSettings } from '../shared/plugins.js'

describe('Test CLI wrapper', function () {
  let server: PeerTubeServer
  let userAccessToken: string

  let cliCommand: CLICommand

  const cmd = 'node ./apps/peertube-cli/dist/peertube.js'

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1, {
      rates_limit: {
        login: {
          max: 30
        }
      }
    })
    await setAccessTokensToServers([ server ])

    await server.users.create({ username: 'user_1', password: 'super_password' })

    userAccessToken = await server.login.getAccessToken({ username: 'user_1', password: 'super_password' })

    {
      const attributes = { name: 'user_channel', displayName: 'User channel', support: 'super support text' }
      await server.channels.create({ token: userAccessToken, attributes })
    }

    cliCommand = server.cli
  })

  describe('Authentication and instance selection', function () {

    it('Should get an access token', async function () {
      const { stdout } = await cliCommand.execWithEnv(`${cmd} token --url ${server.url} --username user_1 --password super_password`)
      const token = stdout.trim()

      const body = await server.users.getMyInfo({ token })
      expect(body.username).to.equal('user_1')
    })

    it('Should display no selected instance', async function () {
      this.timeout(60000)

      const { stdout } = await cliCommand.execWithEnv(`${cmd} --help`)
      expect(stdout).to.contain('no instance selected')
    })

    it('Should add a user', async function () {
      this.timeout(60000)

      await cliCommand.execWithEnv(`${cmd} auth add -u ${server.url} -U user_1 -p super_password`)
    })

    it('Should not fail to add a user if there is a slash at the end of the instance URL', async function () {
      this.timeout(60000)

      let fullServerURL = server.url + '/'

      await cliCommand.execWithEnv(`${cmd} auth add -u ${fullServerURL} -U user_1 -p super_password`)

      fullServerURL = server.url + '/asdfasdf'
      await cliCommand.execWithEnv(`${cmd} auth add -u ${fullServerURL} -U user_1 -p super_password`)
    })

    it('Should default to this user', async function () {
      this.timeout(60000)

      const { stdout } = await cliCommand.execWithEnv(`${cmd} --help`)
      expect(stdout).to.contain(`instance ${server.url} selected`)
    })

    it('Should remember the user', async function () {
      this.timeout(60000)

      const { stdout } = await cliCommand.execWithEnv(`${cmd} auth list`)
      expect(stdout).to.contain(server.url)
    })
  })

  describe('Video upload', function () {

    it('Should upload a video', async function () {
      this.timeout(60000)

      const fixture = buildAbsoluteFixturePath('60fps_720p_small.mp4')
      const params = `-f ${fixture} --video-name 'test upload' --channel-name user_channel --support 'support_text'`

      await cliCommand.execWithEnv(`${cmd} upload ${params}`)
    })

    it('Should have the video uploaded', async function () {
      const { total, data } = await server.videos.list()
      expect(total).to.equal(1)

      const video = await server.videos.get({ id: data[0].uuid })
      expect(video.name).to.equal('test upload')
      expect(video.support).to.equal('support_text')
      expect(video.channel.name).to.equal('user_channel')
    })
  })

  describe('Admin auth', function () {

    it('Should remove the auth user', async function () {
      await cliCommand.execWithEnv(`${cmd} auth del ${server.url}`)

      const { stdout } = await cliCommand.execWithEnv(`${cmd} --help`)
      expect(stdout).to.contain('no instance selected')
    })

    it('Should add the admin user', async function () {
      await cliCommand.execWithEnv(`${cmd} auth add -u ${server.url} -U root -p test${server.internalServerNumber}`)
    })
  })

  describe('Manage plugins', function () {

    it('Should install a plugin', async function () {
      this.timeout(60000)

      await cliCommand.execWithEnv(`${cmd} plugins install --npm-name peertube-plugin-hello-world`)
    })

    it('Should have registered settings', async function () {
      await testHelloWorldRegisteredSettings(server)
    })

    it('Should list installed plugins', async function () {
      const { stdout } = await cliCommand.execWithEnv(`${cmd} plugins list`)

      expect(stdout).to.contain('peertube-plugin-hello-world')
    })

    it('Should uninstall the plugin', async function () {
      const { stdout } = await cliCommand.execWithEnv(`${cmd} plugins uninstall --npm-name peertube-plugin-hello-world`)

      expect(stdout).to.not.contain('peertube-plugin-hello-world')
    })

    it('Should install a plugin in requested version', async function () {
      this.timeout(60000)

      await cliCommand.execWithEnv(`${cmd} plugins install --npm-name peertube-plugin-hello-world --plugin-version 0.0.17`)
    })

    it('Should list installed plugins, in correct version', async function () {
      const { stdout } = await cliCommand.execWithEnv(`${cmd} plugins list`)

      expect(stdout).to.contain('peertube-plugin-hello-world')
      expect(stdout).to.contain('0.0.17')
    })

    it('Should uninstall the plugin again', async function () {
      const { stdout } = await cliCommand.execWithEnv(`${cmd} plugins uninstall --npm-name peertube-plugin-hello-world`)

      expect(stdout).to.not.contain('peertube-plugin-hello-world')
    })

    it('Should install a plugin in requested beta version', async function () {
      this.timeout(60000)

      await cliCommand.execWithEnv(`${cmd} plugins install --npm-name peertube-plugin-hello-world --plugin-version 0.0.21-beta.1`)

      const { stdout } = await cliCommand.execWithEnv(`${cmd} plugins list`)

      expect(stdout).to.contain('peertube-plugin-hello-world')
      expect(stdout).to.contain('0.0.21-beta.1')

      await cliCommand.execWithEnv(`${cmd} plugins uninstall --npm-name peertube-plugin-hello-world`)
    })
  })

  describe('Manage video redundancies', function () {
    let anotherServer: PeerTubeServer
    let video1Server2: number
    let servers: PeerTubeServer[]

    before(async function () {
      this.timeout(120000)

      anotherServer = await createSingleServer(2)
      await setAccessTokensToServers([ anotherServer ])

      await doubleFollow(server, anotherServer)

      servers = [ server, anotherServer ]
      await waitJobs(servers)

      const { uuid } = await anotherServer.videos.quickUpload({ name: 'super video' })
      await waitJobs(servers)

      video1Server2 = await server.videos.getId({ uuid })
    })

    it('Should add a redundancy', async function () {
      this.timeout(60000)

      const params = `add --video ${video1Server2}`
      await cliCommand.execWithEnv(`${cmd} redundancy ${params}`)

      await waitJobs(servers)
    })

    it('Should list redundancies', async function () {
      this.timeout(60000)

      {
        const params = 'list-my-redundancies'
        const { stdout } = await cliCommand.execWithEnv(`${cmd} redundancy ${params}`)

        expect(stdout).to.contain('super video')
        expect(stdout).to.contain(server.host)
      }
    })

    it('Should remove a redundancy', async function () {
      this.timeout(60000)

      const params = `remove --video ${video1Server2}`
      await cliCommand.execWithEnv(`${cmd} redundancy ${params}`)

      await waitJobs(servers)

      {
        const params = 'list-my-redundancies'
        const { stdout } = await cliCommand.execWithEnv(`${cmd} redundancy ${params}`)

        expect(stdout).to.not.contain('super video')
      }
    })

    after(async function () {
      await cleanupTests([ anotherServer ])
    })
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
