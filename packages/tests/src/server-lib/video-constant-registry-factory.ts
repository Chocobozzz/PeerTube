/* eslint-disable @typescript-eslint/no-unused-expressions */
import { expect } from 'chai'
import { VideoPlaylistPrivacyType, VideoPrivacyType } from '@peertube/peertube-models'
import {
  VIDEO_CATEGORIES,
  VIDEO_LANGUAGES,
  VIDEO_LICENCES,
  VIDEO_PLAYLIST_PRIVACIES,
  VIDEO_PRIVACIES
} from '@peertube/peertube-server/core/initializers/constants.js'
import { VideoConstantManagerFactory } from '@peertube/peertube-server/core/lib/plugins/video-constant-manager-factory.js'

describe('VideoConstantManagerFactory', function () {
  const factory = new VideoConstantManagerFactory('peertube-plugin-constants')

  afterEach(() => {
    factory.resetVideoConstants('peertube-plugin-constants')
  })

  describe('VideoCategoryManager', () => {
    const videoCategoryManager = factory.createVideoConstantManager<number>('category')

    it('Should be able to list all video category constants', () => {
      const constants = videoCategoryManager.getConstants()
      expect(constants).to.deep.equal(VIDEO_CATEGORIES)
    })

    it('Should be able to delete a video category constant', () => {
      const successfullyDeleted = videoCategoryManager.deleteConstant(1)
      expect(successfullyDeleted).to.be.true
      expect(videoCategoryManager.getConstantValue(1)).to.be.undefined
    })

    it('Should be able to add a video category constant', () => {
      const successfullyAdded = videoCategoryManager.addConstant(42, 'The meaning of life')
      expect(successfullyAdded).to.be.true
      expect(videoCategoryManager.getConstantValue(42)).to.equal('The meaning of life')
    })

    it('Should be able to reset video category constants', () => {
      videoCategoryManager.deleteConstant(1)
      videoCategoryManager.resetConstants()
      expect(videoCategoryManager.getConstantValue(1)).not.be.undefined
    })
  })

  describe('VideoLicenceManager', () => {
    const videoLicenceManager = factory.createVideoConstantManager<number>('licence')
    it('Should be able to list all video licence constants', () => {
      const constants = videoLicenceManager.getConstants()
      expect(constants).to.deep.equal(VIDEO_LICENCES)
    })

    it('Should be able to delete a video licence constant', () => {
      const successfullyDeleted = videoLicenceManager.deleteConstant(1)
      expect(successfullyDeleted).to.be.true
      expect(videoLicenceManager.getConstantValue(1)).to.be.undefined
    })

    it('Should be able to add a video licence constant', () => {
      const successfullyAdded = videoLicenceManager.addConstant(42, 'European Union Public Licence')
      expect(successfullyAdded).to.be.true
      expect(videoLicenceManager.getConstantValue(42 as any)).to.equal('European Union Public Licence')
    })

    it('Should be able to reset video licence constants', () => {
      videoLicenceManager.deleteConstant(1)
      videoLicenceManager.resetConstants()
      expect(videoLicenceManager.getConstantValue(1)).not.be.undefined
    })
  })

  describe('PlaylistPrivacyManager', () => {
    const playlistPrivacyManager = factory.createVideoConstantManager<VideoPlaylistPrivacyType>('playlistPrivacy')
    it('Should be able to list all video playlist privacy constants', () => {
      const constants = playlistPrivacyManager.getConstants()
      expect(constants).to.deep.equal(VIDEO_PLAYLIST_PRIVACIES)
    })

    it('Should be able to delete a video playlist privacy constant', () => {
      const successfullyDeleted = playlistPrivacyManager.deleteConstant(1)
      expect(successfullyDeleted).to.be.true
      expect(playlistPrivacyManager.getConstantValue(1)).to.be.undefined
    })

    it('Should be able to add a video playlist privacy constant', () => {
      const successfullyAdded = playlistPrivacyManager.addConstant(42 as any, 'Friends only')
      expect(successfullyAdded).to.be.true
      expect(playlistPrivacyManager.getConstantValue(42 as any)).to.equal('Friends only')
    })

    it('Should be able to reset video playlist privacy constants', () => {
      playlistPrivacyManager.deleteConstant(1)
      playlistPrivacyManager.resetConstants()
      expect(playlistPrivacyManager.getConstantValue(1)).not.be.undefined
    })
  })

  describe('VideoPrivacyManager', () => {
    const videoPrivacyManager = factory.createVideoConstantManager<VideoPrivacyType>('privacy')
    it('Should be able to list all video privacy constants', () => {
      const constants = videoPrivacyManager.getConstants()
      expect(constants).to.deep.equal(VIDEO_PRIVACIES)
    })

    it('Should be able to delete a video privacy constant', () => {
      const successfullyDeleted = videoPrivacyManager.deleteConstant(1)
      expect(successfullyDeleted).to.be.true
      expect(videoPrivacyManager.getConstantValue(1)).to.be.undefined
    })

    it('Should be able to add a video privacy constant', () => {
      const successfullyAdded = videoPrivacyManager.addConstant(42 as any, 'Friends only')
      expect(successfullyAdded).to.be.true
      expect(videoPrivacyManager.getConstantValue(42 as any)).to.equal('Friends only')
    })

    it('Should be able to reset video privacy constants', () => {
      videoPrivacyManager.deleteConstant(1)
      videoPrivacyManager.resetConstants()
      expect(videoPrivacyManager.getConstantValue(1)).not.be.undefined
    })
  })

  describe('VideoLanguageManager', () => {
    const videoLanguageManager = factory.createVideoConstantManager<string>('language')
    it('Should be able to list all video language constants', () => {
      const constants = videoLanguageManager.getConstants()
      expect(constants).to.deep.equal(VIDEO_LANGUAGES)
    })

    it('Should be able to add a video language constant', () => {
      const successfullyAdded = videoLanguageManager.addConstant('fr', 'Fr occitan')
      expect(successfullyAdded).to.be.true
      expect(videoLanguageManager.getConstantValue('fr')).to.equal('Fr occitan')
    })

    it('Should be able to delete a video language constant', () => {
      videoLanguageManager.addConstant('fr', 'Fr occitan')
      const successfullyDeleted = videoLanguageManager.deleteConstant('fr')
      expect(successfullyDeleted).to.be.true
      expect(videoLanguageManager.getConstantValue('fr')).to.be.undefined
    })

    it('Should be able to reset video language constants', () => {
      videoLanguageManager.addConstant('fr', 'Fr occitan')
      videoLanguageManager.resetConstants()
      expect(videoLanguageManager.getConstantValue('fr')).to.be.undefined
    })
  })
})
