import { copy, readFile, remove, rename } from 'fs-extra'
import Jimp, { read as jimpRead } from 'jimp'
import { join } from 'path'
import { ColorActionName } from '@jimp/plugin-color'
import { getLowercaseExtension } from '@shared/core-utils'
import { buildUUID } from '@shared/extra-utils'
import { convertWebPToJPG, generateThumbnailFromVideo, processGIF } from './ffmpeg'
import { logger, loggerTagsFactory } from './logger'

const lTags = loggerTagsFactory('image-utils')

function generateImageFilename (extension = '.jpg') {
  return buildUUID() + extension
}

async function processImage (options: {
  path: string
  destination: string
  newSize: { width: number, height: number }
  keepOriginal?: boolean // default false
}) {
  const { path, destination, newSize, keepOriginal = false } = options

  const extension = getLowercaseExtension(path)

  if (path === destination) {
    throw new Error('Jimp/FFmpeg needs an input path different that the output path.')
  }

  logger.debug('Processing image %s to %s.', path, destination)

  // Use FFmpeg to process GIF
  if (extension === '.gif') {
    await processGIF({ path, destination, newSize })
  } else {
    await jimpProcessor(path, destination, newSize, extension)
  }

  if (keepOriginal !== true) await remove(path)
}

async function generateImageFromVideoFile (options: {
  fromPath: string
  folder: string
  imageName: string
  size: { width: number, height: number }
}) {
  const { fromPath, folder, imageName, size } = options

  const pendingImageName = 'pending-' + imageName
  const pendingImagePath = join(folder, pendingImageName)

  try {
    await generateThumbnailFromVideo({ fromPath, output: pendingImagePath })

    const destination = join(folder, imageName)
    await processImage({ path: pendingImagePath, destination, newSize: size })
  } catch (err) {
    logger.error('Cannot generate image from video %s.', fromPath, { err, ...lTags() })

    try {
      await remove(pendingImagePath)
    } catch (err) {
      logger.debug('Cannot remove pending image path after generation error.', { err, ...lTags() })
    }
  }
}

async function getImageSize (path: string) {
  const inputBuffer = await readFile(path)

  const image = await jimpRead(inputBuffer)

  return {
    width: image.getWidth(),
    height: image.getHeight()
  }
}

// ---------------------------------------------------------------------------

export {
  generateImageFilename,
  generateImageFromVideoFile,

  processImage,

  getImageSize
}

// ---------------------------------------------------------------------------

async function jimpProcessor (path: string, destination: string, newSize: { width: number, height: number }, inputExt: string) {
  let sourceImage: Jimp
  const inputBuffer = await readFile(path)

  try {
    sourceImage = await jimpRead(inputBuffer)
  } catch (err) {
    logger.debug('Cannot read %s with jimp. Try to convert the image using ffmpeg first.', path, { err })

    const newName = path + '.jpg'
    await convertWebPToJPG({ path, destination: newName })
    await rename(newName, path)

    sourceImage = await jimpRead(path)
  }

  await remove(destination)

  // Optimization if the source file has the appropriate size
  const outputExt = getLowercaseExtension(destination)
  if (skipProcessing({ sourceImage, newSize, imageBytes: inputBuffer.byteLength, inputExt, outputExt })) {
    return copy(path, destination)
  }

  await autoResize({ sourceImage, newSize, destination })
}

async function autoResize (options: {
  sourceImage: Jimp
  newSize: { width: number, height: number }
  destination: string
}) {
  const { sourceImage, newSize, destination } = options

  // Portrait mode targeting a landscape, apply some effect on the image
  const sourceIsPortrait = sourceImage.getWidth() < sourceImage.getHeight()
  const destIsPortraitOrSquare = newSize.width <= newSize.height

  removeExif(sourceImage)

  if (sourceIsPortrait && !destIsPortraitOrSquare) {
    const baseImage = sourceImage.cloneQuiet().cover(newSize.width, newSize.height)
                                              .color([ { apply: ColorActionName.SHADE, params: [ 50 ] } ])

    const topImage = sourceImage.cloneQuiet().contain(newSize.width, newSize.height)

    return write(baseImage.blit(topImage, 0, 0), destination)
  }

  return write(sourceImage.cover(newSize.width, newSize.height), destination)
}

function write (image: Jimp, destination: string) {
  return image.quality(80).writeAsync(destination)
}

function skipProcessing (options: {
  sourceImage: Jimp
  newSize: { width: number, height: number }
  imageBytes: number
  inputExt: string
  outputExt: string
}) {
  const { sourceImage, newSize, imageBytes, inputExt, outputExt } = options
  const { width, height } = newSize

  if (hasExif(sourceImage)) return false
  if (sourceImage.getWidth() > width || sourceImage.getHeight() > height) return false
  if (inputExt !== outputExt) return false

  const kB = 1000

  if (height >= 1000) return imageBytes <= 200 * kB
  if (height >= 500) return imageBytes <= 100 * kB

  return imageBytes <= 15 * kB
}

function hasExif (image: Jimp) {
  return !!(image.bitmap as any).exifBuffer
}

function removeExif (image: Jimp) {
  (image.bitmap as any).exifBuffer = null
}
