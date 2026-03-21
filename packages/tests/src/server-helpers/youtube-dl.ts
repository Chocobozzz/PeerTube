/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { join } from 'path'
import { YoutubeDLCLI } from '@peertube/peertube-server/core/helpers/youtube-dl/youtube-dl-cli.js'
import { CONFIG } from '@peertube/peertube-server/core/initializers/config.js'

describe('YoutubeDLCLI', function () {

  describe('wrapWithJSRuntimeOptions', function () {
    let cli: any

    before(function () {
      cli = Object.create(YoutubeDLCLI.prototype)
    })

    it('Should include process.execPath in --js-runtimes when using yt-dlp', function () {
      const originalDescriptor = Object.getOwnPropertyDescriptor(CONFIG.IMPORT.VIDEOS.HTTP.YOUTUBE_DL_RELEASE, 'NAME')

      Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.YOUTUBE_DL_RELEASE, 'NAME', {
        get: () => 'yt-dlp',
        configurable: true
      })

      try {
        const inputArgs = [ '--dump-json', '-f', 'best' ]
        const result: string[] = cli.wrapWithJSRuntimeOptions(inputArgs)

        expect(result[0]).to.equal('--js-runtimes')
        expect(result[1]).to.equal('node:' + process.execPath)
        expect(result[1]).to.match(/^node:\//)
        expect(result.slice(2)).to.deep.equal(inputArgs)
      } finally {
        Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.YOUTUBE_DL_RELEASE, 'NAME', originalDescriptor)
      }
    })

    it('Should not modify args when not using yt-dlp', function () {
      const originalDescriptor = Object.getOwnPropertyDescriptor(CONFIG.IMPORT.VIDEOS.HTTP.YOUTUBE_DL_RELEASE, 'NAME')

      Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.YOUTUBE_DL_RELEASE, 'NAME', {
        get: () => 'youtube-dl',
        configurable: true
      })

      try {
        const inputArgs = [ '--dump-json', '-f', 'best' ]
        const result: string[] = cli.wrapWithJSRuntimeOptions(inputArgs)

        expect(result).to.deep.equal(inputArgs)
      } finally {
        Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.YOUTUBE_DL_RELEASE, 'NAME', originalDescriptor)
      }
    })

    it('Should prepend runtime options before existing args', function () {
      const originalDescriptor = Object.getOwnPropertyDescriptor(CONFIG.IMPORT.VIDEOS.HTTP.YOUTUBE_DL_RELEASE, 'NAME')

      Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.YOUTUBE_DL_RELEASE, 'NAME', {
        get: () => 'yt-dlp',
        configurable: true
      })

      try {
        const inputArgs = [ '--skip-download' ]
        const result: string[] = cli.wrapWithJSRuntimeOptions(inputArgs)

        expect(result).to.have.lengthOf(3)
        expect(result[0]).to.equal('--js-runtimes')
        expect(result[1]).to.equal('node:' + process.execPath)
        expect(result[2]).to.equal('--skip-download')
      } finally {
        Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.YOUTUBE_DL_RELEASE, 'NAME', originalDescriptor)
      }
    })

    it('Should handle empty args array', function () {
      const originalDescriptor = Object.getOwnPropertyDescriptor(CONFIG.IMPORT.VIDEOS.HTTP.YOUTUBE_DL_RELEASE, 'NAME')

      Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.YOUTUBE_DL_RELEASE, 'NAME', {
        get: () => 'yt-dlp',
        configurable: true
      })

      try {
        const result: string[] = cli.wrapWithJSRuntimeOptions([])

        expect(result).to.have.lengthOf(2)
        expect(result[0]).to.equal('--js-runtimes')
        expect(result[1]).to.equal('node:' + process.execPath)
      } finally {
        Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.YOUTUBE_DL_RELEASE, 'NAME', originalDescriptor)
      }
    })
  })

  describe('wrapWithCookiesOptions', function () {
    let cli: any

    before(function () {
      cli = Object.create(YoutubeDLCLI.prototype)
    })

    it('Should prepend cookies file when configured', function () {
      const originalImportDirDescriptor = Object.getOwnPropertyDescriptor(CONFIG.STORAGE, 'IMPORT_DIR')
      const originalCookiesEnabledDescriptor = Object.getOwnPropertyDescriptor(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED')

      Object.defineProperty(CONFIG.STORAGE, 'IMPORT_DIR', {
        get: () => '/tmp/peertube-import',
        configurable: true
      })

      Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED', {
        get: () => true,
        configurable: true
      })

      try {
        const inputArgs = [ '--dump-json', '-f', 'best' ]
        const result: string[] = cli.wrapWithCookiesOptions(inputArgs)

        expect(result).to.deep.equal([ '--cookies', join('/tmp/peertube-import', 'cookies.txt'), ...inputArgs ])
      } finally {
        Object.defineProperty(CONFIG.STORAGE, 'IMPORT_DIR', originalImportDirDescriptor)
        Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED', originalCookiesEnabledDescriptor)
      }
    })

    it('Should not modify args when cookies file is not configured', function () {
      const originalCookiesEnabledDescriptor = Object.getOwnPropertyDescriptor(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED')

      Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED', {
        get: () => false,
        configurable: true
      })

      try {
        const inputArgs = [ '--dump-json', '-f', 'best' ]
        const result: string[] = cli.wrapWithCookiesOptions(inputArgs)

        expect(result).to.deep.equal(inputArgs)
      } finally {
        Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED', originalCookiesEnabledDescriptor)
      }
    })
  })
})
