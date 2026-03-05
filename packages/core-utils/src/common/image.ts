import { ThumbnailAspectRatio } from '@peertube/peertube-models'
import { maxBy } from './array.js'

export function findAppropriateThumbnail<T extends { width: number, aspectRatio: ThumbnailAspectRatio }> (
  images: T[],
  wantedWidth: number,
  ratio: ThumbnailAspectRatio
) {
  if (!images) return null

  return findAppropriateImage(
    images.filter(img => img.aspectRatio === ratio),
    wantedWidth
  )
}

export function findAppropriateImage<T extends { width: number }> (images: T[], wantedWidth: number) {
  if (!wantedWidth) throw new Error('Invalid width to find appropriate image')
  if (!images || images.length === 0) return undefined

  let candidate: T

  for (const img of images) {
    if (img.width >= wantedWidth && (!candidate || img.width < candidate.width)) {
      candidate = img
    }
  }

  return candidate || maxBy(images, 'width')
}

export function guessAspectRatio (width: number, height: number): ThumbnailAspectRatio {
  const ratio = width / height

  if (ratio >= 1.77) return '16:9'
  if (ratio >= 1.6) return '16:10'
  if (ratio >= 1.33) return '4:3'
  if (ratio >= 1.25) return '5:4'

  return '1:1'
}
