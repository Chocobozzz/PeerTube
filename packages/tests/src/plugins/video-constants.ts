/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import {
  cleanupTests,
  createSingleServer,
  makeGetRequest,
  PeerTubeServer,
  PluginsCommand,
  setAccessTokensToServers
} from '@peertube/peertube-server-commands'
import { HttpStatusCode, VideoPlaylistPrivacy, VideoPrivacy } from '@peertube/peertube-models'

describe('Test plugin altering video constants', function () {
  let server: PeerTubeServer

  before(async function () {
    this.timeout(30000)

    server = await createSingleServer(1)
    await setAccessTokensToServers([ server ])

    await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-video-constants') })
  })

  it('Should have updated languages', async function () {
    const languages = await server.videos.getLanguages()

    expect(languages['en']).to.not.exist
    expect(languages['fr']).to.not.exist

    expect(languages['al_bhed']).to.equal('Al Bhed')
    expect(languages['al_bhed2']).to.equal('Al Bhed 2')
    expect(languages['al_bhed3']).to.not.exist
  })

  it('Should have updated categories', async function () {
    const categories = await server.videos.getCategories()

    expect(categories[1]).to.not.exist
    expect(categories[2]).to.not.exist

    expect(categories[42]).to.equal('Best category')
    expect(categories[43]).to.equal('High best category')
  })

  it('Should have updated licences', async function () {
    const licences = await server.videos.getLicences()

    expect(licences[1]).to.not.exist
    expect(licences[7]).to.not.exist

    expect(licences[42]).to.equal('Best licence')
    expect(licences[43]).to.equal('High best licence')
  })

  it('Should have updated video privacies', async function () {
    const privacies = await server.videos.getPrivacies()

    expect(privacies[1]).to.exist
    expect(privacies[2]).to.not.exist
    expect(privacies[3]).to.exist
    expect(privacies[4]).to.exist
  })

  it('Should have updated playlist privacies', async function () {
    const playlistPrivacies = await server.playlists.getPrivacies()

    expect(playlistPrivacies[1]).to.exist
    expect(playlistPrivacies[2]).to.exist
    expect(playlistPrivacies[3]).to.not.exist
  })

  it('Should not be able to create a video with this privacy', async function () {
    const attributes = { name: 'video', privacy: VideoPrivacy.UNLISTED }
    await server.videos.upload({ attributes, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should not be able to create a video with this privacy', async function () {
    const attributes = { displayName: 'video playlist', privacy: VideoPlaylistPrivacy.PRIVATE }
    await server.playlists.create({ attributes, expectedStatus: HttpStatusCode.BAD_REQUEST_400 })
  })

  it('Should be able to upload a video with these values', async function () {
    const attributes = { name: 'video', category: 42, licence: 42, language: 'al_bhed2' }
    const { uuid } = await server.videos.upload({ attributes })

    const video = await server.videos.get({ id: uuid })
    expect(video.language.label).to.equal('Al Bhed 2')
    expect(video.licence.label).to.equal('Best licence')
    expect(video.category.label).to.equal('Best category')
  })

  it('Should uninstall the plugin and reset languages, categories, licences and privacies', async function () {
    await server.plugins.uninstall({ npmName: 'peertube-plugin-test-video-constants' })

    {
      const languages = await server.videos.getLanguages()

      expect(languages['en']).to.equal('English')
      expect(languages['fr']).to.equal('French')

      expect(languages['al_bhed']).to.not.exist
      expect(languages['al_bhed2']).to.not.exist
      expect(languages['al_bhed3']).to.not.exist
    }

    {
      const categories = await server.videos.getCategories()

      expect(categories[1]).to.equal('Music')
      expect(categories[2]).to.equal('Films')

      expect(categories[42]).to.not.exist
      expect(categories[43]).to.not.exist
    }

    {
      const licences = await server.videos.getLicences()

      expect(licences[1]).to.equal('Attribution')
      expect(licences[7]).to.equal('Public Domain Dedication')

      expect(licences[42]).to.not.exist
      expect(licences[43]).to.not.exist
    }

    {
      const privacies = await server.videos.getPrivacies()

      expect(privacies[1]).to.exist
      expect(privacies[2]).to.exist
      expect(privacies[3]).to.exist
      expect(privacies[4]).to.exist
    }

    {
      const playlistPrivacies = await server.playlists.getPrivacies()

      expect(playlistPrivacies[1]).to.exist
      expect(playlistPrivacies[2]).to.exist
      expect(playlistPrivacies[3]).to.exist
    }
  })

  it('Should be able to reset categories', async function () {
    await server.plugins.install({ path: PluginsCommand.getPluginTestPath('-video-constants') })

    {
      const categories = await server.videos.getCategories()

      expect(categories[1]).to.not.exist
      expect(categories[2]).to.not.exist

      expect(categories[42]).to.exist
      expect(categories[43]).to.exist
    }

    await makeGetRequest({
      url: server.url,
      token: server.accessToken,
      path: '/plugins/test-video-constants/router/reset-categories',
      expectedStatus: HttpStatusCode.NO_CONTENT_204
    })

    {
      const categories = await server.videos.getCategories()

      expect(categories[1]).to.exist
      expect(categories[2]).to.exist

      expect(categories[42]).to.not.exist
      expect(categories[43]).to.not.exist
    }
  })

  after(async function () {
    await cleanupTests([ server ])
  })
})
