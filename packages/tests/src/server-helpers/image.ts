/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { expect } from 'chai'
import { remove } from 'fs-extra/esm'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { buildAbsoluteFixturePath, root } from '@peertube/peertube-node-utils'
import { execPromise } from '@peertube/peertube-server/core/helpers/core-utils.js'
import { processImage } from '@peertube/peertube-server/core/helpers/image-utils.js'

async function checkBuffers (path1: string, path2: string, equals: boolean) {
  const [ buf1, buf2 ] = await Promise.all([
    readFile(path1),
    readFile(path2)
  ])

  if (equals) {
    expect(buf1.equals(buf2)).to.be.true
  } else {
    expect(buf1.equals(buf2)).to.be.false
  }
}

async function hasTitleExif (path: string) {
  const result = JSON.parse(await execPromise(`exiftool -json ${path}`))

  return result[0]?.Title === 'should be removed'
}

describe('Image helpers', function () {
  const imageDestDir = join(root(), 'test-images')

  const imageDestJPG = join(imageDestDir, 'test.jpg')
  const imageDestPNG = join(imageDestDir, 'test.png')

  const thumbnailSize = { width: 280, height: 157 }

  it('Should skip processing if the source image is okay', async function () {
    const input = buildAbsoluteFixturePath('custom-thumbnail.jpg')
    await processImage({ path: input, destination: imageDestJPG, newSize: thumbnailSize, keepOriginal: true })

    await checkBuffers(input, imageDestJPG, true)
  })

  it('Should not skip processing if the source image does not have the appropriate extension', async function () {
    const input = buildAbsoluteFixturePath('custom-thumbnail.png')
    await processImage({ path: input, destination: imageDestJPG, newSize: thumbnailSize, keepOriginal: true })

    await checkBuffers(input, imageDestJPG, false)
  })

  it('Should not skip processing if the source image does not have the appropriate size', async function () {
    const input = buildAbsoluteFixturePath('custom-preview.jpg')
    await processImage({ path: input, destination: imageDestJPG, newSize: thumbnailSize, keepOriginal: true })

    await checkBuffers(input, imageDestJPG, false)
  })

  it('Should not skip processing if the source image does not have the appropriate size', async function () {
    const input = buildAbsoluteFixturePath('custom-thumbnail-big.jpg')
    await processImage({ path: input, destination: imageDestJPG, newSize: thumbnailSize, keepOriginal: true })

    await checkBuffers(input, imageDestJPG, false)
  })

  it('Should strip exif for a jpg file that can not be copied', async function () {
    const input = buildAbsoluteFixturePath('exif.jpg')
    expect(await hasTitleExif(input)).to.be.true

    await processImage({ path: input, destination: imageDestJPG, newSize: { width: 100, height: 100 }, keepOriginal: true })
    await checkBuffers(input, imageDestJPG, false)

    expect(await hasTitleExif(imageDestJPG)).to.be.false
  })

  it('Should strip exif for a jpg file that could be copied', async function () {
    const input = buildAbsoluteFixturePath('exif.jpg')
    expect(await hasTitleExif(input)).to.be.true

    await processImage({ path: input, destination: imageDestJPG, newSize: thumbnailSize, keepOriginal: true })
    await checkBuffers(input, imageDestJPG, false)

    expect(await hasTitleExif(imageDestJPG)).to.be.false
  })

  it('Should strip exif for png', async function () {
    const input = buildAbsoluteFixturePath('exif.png')
    expect(await hasTitleExif(input)).to.be.true

    await processImage({ path: input, destination: imageDestPNG, newSize: thumbnailSize, keepOriginal: true })
    expect(await hasTitleExif(imageDestPNG)).to.be.false
  })

  after(async function () {
    await remove(imageDestDir)
  })
})
