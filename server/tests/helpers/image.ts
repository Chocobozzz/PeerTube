/* eslint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import 'mocha'
import { readFile, remove } from 'fs-extra'
import { join } from 'path'
import { processImage } from '../../../server/helpers/image-utils'
import { buildAbsoluteFixturePath, root } from '../../../shared/extra-utils'
import { expect } from 'chai'

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

describe('Image helpers', function () {
  const imageDestDir = join(root(), 'test-images')
  const imageDest = join(imageDestDir, 'test.jpg')
  const thumbnailSize = { width: 223, height: 122 }

  it('Should skip processing if the source image is okay', async function () {
    const input = buildAbsoluteFixturePath('thumbnail.jpg')
    await processImage(input, imageDest, thumbnailSize, true)

    await checkBuffers(input, imageDest, true)
  })

  it('Should not skip processing if the source image does not have the appropriate extension', async function () {
    const input = buildAbsoluteFixturePath('thumbnail.png')
    await processImage(input, imageDest, thumbnailSize, true)

    await checkBuffers(input, imageDest, false)
  })

  it('Should not skip processing if the source image does not have the appropriate size', async function () {
    const input = buildAbsoluteFixturePath('preview.jpg')
    await processImage(input, imageDest, thumbnailSize, true)

    await checkBuffers(input, imageDest, false)
  })

  it('Should not skip processing if the source image does not have the appropriate size', async function () {
    const input = buildAbsoluteFixturePath('thumbnail-big.jpg')
    await processImage(input, imageDest, thumbnailSize, true)

    await checkBuffers(input, imageDest, false)
  })

  after(async function () {
    await remove(imageDest)
  })
})
