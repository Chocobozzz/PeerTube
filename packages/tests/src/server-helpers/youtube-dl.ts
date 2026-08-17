/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { YoutubeDLCLI } from '@peertube/peertube-server/core/helpers/youtube-dl/youtube-dl-cli.js'
import { CONFIG } from '@peertube/peertube-server/core/initializers/config.js'
import { expect } from 'chai'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

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
      const originalStdoutWrite = process.stdout.write.bind(process.stdout)
      const tempDir = await mkdtemp(join(tmpdir(), 'peertube-cookies-'))
      const cookiesFile = join(tempDir, 'youtube-cookies.txt')
      let loggedOutput = ''

      Object.defineProperty(CONFIG.STORAGE, 'TMP_PERSISTENT_DIR', {
        get: () => tempDir,
        configurable: true
      })

      Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED', {
        get: () => true,
        configurable: true
      })
      // The logger writes to stdout, and its module-private logger instance can't be reached from here:
      // capture the console transport output instead of trying to mock the logger
      process.stdout.write = ((chunk: any, ...args: any[]) => {
        loggedOutput += chunk.toString()

        return originalStdoutWrite(chunk, ...args)
      }) as typeof process.stdout.write

      try {
        const inputArgs = [ '--dump-json', '-f', 'best' ]
        const result: string[] = await cli.wrapWithCookiesOptions(inputArgs)

        expect(result).to.deep.equal(inputArgs)
        expect(loggedOutput).to.contain('yt-dlp cookies are enabled but the cookies file ' + cookiesFile + ' does not exist')
      } finally {
        Object.defineProperty(CONFIG.STORAGE, 'TMP_PERSISTENT_DIR', originalTmpPersistentDirDescriptor)
        Object.defineProperty(CONFIG.IMPORT.VIDEOS.HTTP.COOKIES, 'ENABLED', originalCookiesEnabledDescriptor)
        process.stdout.write = originalStdoutWrite
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
