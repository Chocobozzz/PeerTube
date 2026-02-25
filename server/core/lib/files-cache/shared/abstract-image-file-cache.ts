import { downloadImageFromWorker } from '@server/lib/worker/parent-process.js'
import { basename, dirname } from 'path'
import { AbstractFileCache, FileModel } from './abstract-file-cache.js'

export interface ImageFileModel extends FileModel {
  width?: number
  height?: number
}

export abstract class AbstractImageFileCache<M extends ImageFileModel> extends AbstractFileCache<M> {
  protected async downloadImpl (image: M) {
    const destPath = this.getFSFileCachedPath(image)

    const downloaderOptions = {
      url: image.fileUrl,
      destDir: dirname(destPath),
      destName: basename(destPath),
      size: this.getImageSize(image)
    }

    return downloadImageFromWorker(downloaderOptions)
  }

  private getImageSize (image: M): { width: number, height: number } {
    if (image.width && image.height) {
      return {
        height: image.height,
        width: image.width
      }
    }

    return undefined
  }
}
