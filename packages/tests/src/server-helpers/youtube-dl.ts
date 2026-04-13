/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { YoutubeDLCLI } from '@peertube/peertube-server/core/helpers/youtube-dl/youtube-dl-cli.js'
import { logger } from '@peertube/peertube-server/core/helpers/logger.js'
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

    it('Should prepend cookies file when configured and the file exists', async function () {
      const originalTmpPersistentDirDescriptor = Object.getOwnPropertyDescriptor(CONFIG.STORAGE, 'TMP_PERSISTENT_DIR')
      const originalCookiesEnabledDescriptor = Object.getOwnPropertyDescriptor(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED')
      const tempDir = await mkdtemp(join(tmpdir(), 'peertube-cookies-'))
      const cookiesFile = join(tempDir, 'youtube-cookies.txt')

      await writeFile(cookiesFile, '# Netscape HTTP Cookie File\n')

      Object.defineProperty(CONFIG.STORAGE, 'TMP_PERSISTENT_DIR', {
        get: () => tempDir,
        configurable: true
      })

      Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED', {
        get: () => true,
        configurable: true
      })

      try {
        const inputArgs = [ '--dump-json', '-f', 'best' ]
        const result: string[] = await cli.wrapWithCookiesOptions(inputArgs)

        expect(result).to.deep.equal([ '--cookies', cookiesFile, ...inputArgs ])
      } finally {
        Object.defineProperty(CONFIG.STORAGE, 'TMP_PERSISTENT_DIR', originalTmpPersistentDirDescriptor)
        Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED', originalCookiesEnabledDescriptor)
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    it('Should log an error and continue when the cookies file is missing', async function () {
      const originalTmpPersistentDirDescriptor = Object.getOwnPropertyDescriptor(CONFIG.STORAGE, 'TMP_PERSISTENT_DIR')
      const originalCookiesEnabledDescriptor = Object.getOwnPropertyDescriptor(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED')
      const originalLoggerError = logger.error
      const tempDir = await mkdtemp(join(tmpdir(), 'peertube-cookies-'))
      const loggedMessages: any[][] = []

      Object.defineProperty(CONFIG.STORAGE, 'TMP_PERSISTENT_DIR', {
        get: () => tempDir,
        configurable: true
      })

      Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED', {
        get: () => true,
        configurable: true
      })

      ;(logger as any).error = (...args: any[]) => {
        loggedMessages.push(args)
      }

      try {
        const inputArgs = [ '--dump-json', '-f', 'best' ]
        const result: string[] = await cli.wrapWithCookiesOptions(inputArgs)

        expect(result).to.deep.equal(inputArgs)
        expect(loggedMessages).to.have.lengthOf(1)
        expect(loggedMessages[0][0]).to.contain('yt-dlp cookies are enabled but the cookies file %s does not exist')
      } finally {
        Object.defineProperty(CONFIG.STORAGE, 'TMP_PERSISTENT_DIR', originalTmpPersistentDirDescriptor)
        Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED', originalCookiesEnabledDescriptor)
        ;(logger as any).error = originalLoggerError
        await rm(tempDir, { recursive: true, force: true })
      }
    })

    it('Should not modify args when cookies are disabled', async function () {
      const originalCookiesEnabledDescriptor = Object.getOwnPropertyDescriptor(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED')

      Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED', {
        get: () => false,
        configurable: true
      })

      try {
        const inputArgs = [ '--dump-json', '-f', 'best' ]
        const result: string[] = await cli.wrapWithCookiesOptions(inputArgs)

        expect(result).to.deep.equal(inputArgs)
      } finally {
        Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED', originalCookiesEnabledDescriptor)
      }
    })
  })
})
