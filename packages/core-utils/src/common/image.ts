import { maxBy } from './array.js'

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
