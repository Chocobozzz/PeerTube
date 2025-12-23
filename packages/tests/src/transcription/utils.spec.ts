import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'
import { downloadFile, unzip } from '@peertube/peertube-transcription-devtools'
import { expect } from 'chai'
import { ensureDir, remove } from 'fs-extra/esm'
import { cp, lstat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('downloadFile', function () {
  const testDirectory = join(tmpdir(), 'peertube-transcription', 'utils')

  before(async function () {
    await ensureDir(testDirectory)
  })

  it(`Downloads a file and write it to the disk `, async function () {
    const filePath = await downloadFile('https://download.cpy.re/peertube/4k_file.txt', testDirectory)

    expect(await lstat(filePath).then(stats => stats.isFile())).equals(true)
  })

  after(async function () {
    await remove(testDirectory)
  })
})

describe('unzip', function () {
  const zipFixtureFileName = 'hello_world.zip'
  const zipFixtureFilePath = buildAbsoluteFixturePath(`transcription/${zipFixtureFileName}`)
  const testDirectory = join(tmpdir(), 'peertube-transcription', 'utils')

  before(async function () {
    await ensureDir(testDirectory)
  })

  it(`Extract zip archive to directory`, async function () {
    const zipFilePath = join(testDirectory, zipFixtureFileName)
    await cp(zipFixtureFilePath, zipFilePath)
    const unzippedDirectory = await unzip(zipFilePath)

    expect(await lstat(unzippedDirectory).then(stats => stats.isDirectory())).equals(true)
  })

  after(async function () {
    await remove(testDirectory)
  })
})
