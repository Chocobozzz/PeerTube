/* oxlint-disable @typescript-eslint/no-unused-expressions,@typescript-eslint/require-await */

import { buildAbsoluteFixturePath, root } from '@peertube/peertube-node-utils'
import { execPromise } from '@peertube/peertube-server/core/helpers/core-utils.js'
import { processImage, processSVG } from '@peertube/peertube-server/core/helpers/image-utils.js'
import { expect } from 'chai'
import { ensureDir, remove } from 'fs-extra/esm'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import sharp from 'sharp'

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
    const input = buildAbsoluteFixturePath('custom-thumbnail-280x157.jpg')
    await processImage({ path: input, destination: imageDestJPG, newSize: thumbnailSize, keepOriginal: true })

    await checkBuffers(input, imageDestJPG, true)
  })

  it('Should not skip processing if the source image does not have the appropriate extension', async function () {
    const input = buildAbsoluteFixturePath('custom-thumbnail.png')
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

  it('Should process animated gif', async function () {
    const ext = '.gif'

    const input = buildAbsoluteFixturePath(`animated${ext}`)

    const dest = join(imageDestDir, `animated${ext}`)
    await processImage({ path: input, destination: dest, newSize: thumbnailSize, keepOriginal: true })

    const inputBuffer = await readFile(dest)

    const sharpInstance = sharp(inputBuffer, { animated: true })
    const metadata = await sharpInstance.metadata()

    expect(metadata.pages).to.equal(25)
  })

  it('Should not process animated gif/webp with too many frames', async function () {
    const ext = '.gif'

    const input = buildAbsoluteFixturePath(`animated-many-frames${ext}`)

    const dest = join(imageDestDir, `animated-many-frames${ext}`)
    await processImage({ path: input, destination: dest, newSize: thumbnailSize, keepOriginal: true })

    const inputBuffer = await readFile(dest)

    const sharpInstance = sharp(inputBuffer, { animated: true })
    const metadata = await sharpInstance.metadata()

    expect(metadata.pages).to.equal(1)
  })

  after(async function () {
    await remove(imageDestDir)
  })
})

describe('SVG sanitization', function () {
  const svgDir = join(root(), 'test-svg')
  const svgSrc = join(svgDir, 'input.svg')
  const svgDest = join(svgDir, 'output.svg')

  async function sanitize (content: string) {
    await ensureDir(svgDir)
    await writeFile(svgSrc, content)

    await processSVG({ path: svgSrc, destination: svgDest })

    return readFile(svgDest, 'utf-8')
  }

  it('Should remove script tags', async function () {
    const result = await sanitize(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle cx="5" cy="5" r="5"/></svg>'
    )

    expect(result).to.not.contain('script')
    expect(result).to.not.contain('alert')
    expect(result).to.contain('circle')
  })

  it('Should remove event handler attributes', async function () {
    const result = await sanitize(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="10" height="10" onclick="alert(2)"/></svg>'
    )

    expect(result).to.not.contain('onload')
    expect(result).to.not.contain('onclick')
    expect(result).to.not.contain('alert')
    expect(result).to.contain('rect')
  })

  it('Should remove foreignObject that can embed arbitrary HTML', async function () {
    const result = await sanitize(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<foreignObject width="100" height="100"><body xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror="alert(1)"></body></foreignObject>' +
        '</svg>'
    )

    expect(result).to.not.contain('foreignObject')
    expect(result).to.not.contain('onerror')
    expect(result).to.not.contain('alert')
  })

  it('Should remove javascript: hrefs', async function () {
    const result = await sanitize(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<a href="javascript:alert(1)"><text x="0" y="0">click</text></a>' +
        '<use xlink:href="javascript:alert(2)"/>' +
        '</svg>'
    )

    // oxlint-disable-next-line no-script-url
    expect(result).to.not.contain('javascript:')
    expect(result).to.not.contain('alert')
  })

  it('Should remove animation elements that can inject event handlers', async function () {
    const result = await sanitize(
      '<svg xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="10" height="10"><set attributeName="onload" to="alert(1)"/></rect>' +
        '<animate attributeName="href" to="javascript:alert(2)"/>' +
        '</svg>'
    )

    expect(result).to.not.contain('animate')
    expect(result.toLowerCase()).to.not.contain('<set')
    expect(result).to.not.contain('alert')
    // oxlint-disable-next-line no-script-url
    expect(result).to.not.contain('javascript:')
  })

  it('Should keep valid SVG content and case sensitive attributes', async function () {
    const input = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<defs><linearGradient id="g" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/></linearGradient></defs>' +
      '<path d="M10 10 H 90 V 90 H 10 Z" fill="url(#g)" stroke="#000"/>' +
      '<circle cx="50" cy="50" r="40"/>' +
      '</svg>'

    const result = await sanitize(input)

    expect(result).to.contain('viewBox="0 0 100 100"')
    expect(result).to.contain('linearGradient')
    expect(result).to.contain('gradientUnits="userSpaceOnUse"')
    expect(result).to.contain('d="M10 10 H 90 V 90 H 10 Z"')
    expect(result).to.contain('fill="url(#g)"')
    expect(result).to.contain('circle')
  })

  after(async function () {
    await remove(svgDir)
  })
})
