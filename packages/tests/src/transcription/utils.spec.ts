import { cp, lstat, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { expect } from 'chai'
import { downloadFile, unzip } from '@peertube/peertube-transcription'
import { buildAbsoluteFixturePath } from '@peertube/peertube-node-utils'

describe('downloadFile', function () {
  const testDirectory = join(tmpdir(), 'peertube-transcription', 'utils')
  before(async function () {
    await mkdir(testDirectory, { recursive: true })
  })

  it(`Downloads a file and write it to the disk `, async function () {
    const filePath = await downloadFile('https://download.cpy.re/peertube/4k_file.txt', testDirectory)

    expect(await lstat(filePath).then(stats => stats.isFile())).equals(true)
  })

  after(async function () {
    await rm(testDirectory, { recursive: true, force: true })
  })
})

describe('unzip', function () {
  const zipFixtureFileName = 'hello_world.zip'
  const zipFixtureFilePath = buildAbsoluteFixturePath(`transcription/${zipFixtureFileName}`)
  const testDirectory = join(tmpdir(), 'peertube-transcription', 'utils')
  before(async function () {
    await mkdir(testDirectory, { recursive: true })
  })

  it(`Extract zip archive to directory`, async function () {
    const zipFilePath = join(testDirectory, zipFixtureFileName)
    await cp(zipFixtureFilePath, zipFilePath)
    const unzippedDirectory = await unzip(zipFilePath)

    expect(await lstat(unzippedDirectory).then(stats => stats.isDirectory())).equals(true)
  })

  after(async function () {
    await rm(testDirectory, { recursive: true, force: true })
  })
})
