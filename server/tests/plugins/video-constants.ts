/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import * as chai from 'chai'
import { HttpStatusCode } from '@shared/core-utils'
import { cleanupTests, flushAndRunServer, PluginsCommand, ServerInfo, setAccessTokensToServers } from '@shared/extra-utils'
import { VideoPlaylistPrivacy } from '@shared/models'

const expect = chai.expect

describe('Test plugin altering video constants', function () {
  let server: ServerInfo

  before(async function () {
    this.timeout(30000)

    server = await flushAndRunServer(1)
    await setAccessTokensToServers([ server ])

    await server.pluginsCommand.install({ path: PluginsCommand.getPluginTestPath('-video-constants') })
  })

  it('Should have updated languages', async function () {
    const languages = await server.videosCommand.getLanguages()

    expect(languages['en']).to.not.exist
    expect(languages['fr']).to.not.exist

    expect(languages['al_bhed']).to.equal('Al Bhed')
    expect(languages['al_bhed2']).to.equal('Al Bhed 2')
    expect(languages['al_bhed3']).to.not.exist
  })

  it('Should have updated categories', async function () {
    const categories = await server.videosCommand.getCategories()

    expect(categories[1]).to.not.exist
    expect(categories[2]).to.not.exist

    expect(categories[42]).to.equal('Best category')
    expect(categories[43]).to.equal('High best category')
  })

  it('Should have updated licences', async function () {
    const licences = await server.videosCommand.getLicences()

    expect(licences[1]).to.not.exist
    expect(licences[7]).to.not.exist

    expect(licences[42]).to.equal('Best licence')
    expect(licences[43]).to.equal('High best licence')
  })

  it('Should have updated video privacies', async function () {
    const privacies = await server.videosCommand.getPrivacies()

    expect(privacies[1]).to.exist
    expect(privacies[2]).to.not.exist
    expect(privacies[3]).to.exist
    expect(privacies[4]).to.exist
  })

  it('Should have updated playlist privacies', async function () {
    const playlistPrivacies = await server.playlistsCommand.getPrivacies()

    expect(playlistPrivacies[1]).to.exist
    expect(playlistPrivacies[2]).to.exist
    expect(playlistPrivacies[3]).to.not.exist
  })

  it('Should not be able to create a video with this privacy', async function () {
    const attributes = { name: 'video', privacy: 2 }
    await server.videosCommand.upload({ attributes, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should not be able to create a video with this privacy', async function () {
    const attributes = { displayName: 'video playlist', privacy: VideoPlaylistPrivacy.PRIVATE }
    await server.playlistsCommand.create({ attributes, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should be able to upload a video with these values', async function () {
    const attributes = { name: 'video', category: 42, licence: 42, language: 'al_bhed2' }
    const { uuid } = await server.videosCommand.upload({ attributes })

    const video = await server.videosCommand.get({ id: uuid })
    expect(video.language.label).to.equal('Al Bhed 2')
    expect(video.licence.label).to.equal('Best licence')
    expect(video.category.label).to.equal('Best category')
  })

  it('Should uninstall the plugin and reset languages, categories, licences and privacies', async function () {
    await server.pluginsCommand.uninstall({ npmName: 'peertube-plugin-test-video-constants' })

    {
      const languages = await server.videosCommand.getLanguages()

      expect(languages['en']).to.equal('English')
      expect(languages['fr']).to.equal('French')

      expect(languages['al_bhed']).to.not.exist
      expect(languages['al_bhed2']).to.not.exist
      expect(languages['al_bhed3']).to.not.exist
    }

    {
      const categories = await server.videosCommand.getCategories()

      expect(categories[1]).to.equal('Music')
      expect(categories[2]).to.equal('Films')

      expect(categories[42]).to.not.exist
      expect(categories[43]).to.not.exist
    }

    {
      const licences = await server.videosCommand.getLicences()

      expect(licences[1]).to.equal('Attribution')
      expect(licences[7]).to.equal('Public Domain Dedication')

      expect(licences[42]).to.not.exist
      expect(licences[43]).to.not.exist
    }

    {
      const privacies = await server.videosCommand.getPrivacies()

      expect(privacies[1]).to.exist
      expect(privacies[2]).to.exist
      expect(privacies[3]).to.exist
      expect(privacies[4]).to.exist
    }

    {
      const playlistPrivacies = await server.playlistsCommand.getPrivacies()

      expect(playlistPrivacies[1]).to.exist
      expect(playlistPrivacies[2]).to.exist
      expect(playlistPrivacies[3]).to.exist
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
