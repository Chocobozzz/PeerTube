import { findAppropriateImage } from '@peertube/peertube-core-utils'
import { logger } from './logger'

export function imageToDataURL (input: File | Blob) {
  return new Promise<string>(res => {
    const reader = new FileReader()

    reader.onerror = err => logger.error('Cannot read input file.', err)
    reader.onloadend = () => res(reader.result as string)
    reader.readAsDataURL(input)
  })
}

export function findAppropriateImageFileUrl<T extends { width: number, fileUrl: string }> (images: T[], width: number) {
  return findAppropriateImage(images, width)?.fileUrl || ''
}
