import { objectToFormData } from '@app/helpers'
import { resolveUrl, UploaderX } from 'ngx-uploadx'

/**
 * multipart/form-data uploader extending the UploaderX implementation of Google Resumable
 * for use with multer
 *
 * @see https://github.com/kukhariev/ngx-uploadx/blob/637e258fe366b8095203f387a6101a230ee4f8e6/src/uploadx/lib/uploaderx.ts
 * @example
 *
 *   options: UploadxOptions = {
 *     uploaderClass: UploaderXFormData
 *   };
 */
export class UploaderXFormData extends UploaderX {
  async getFileUrl (): Promise<string> {
    const headers = {
      'X-Upload-Content-Length': this.size.toString(),
      'X-Upload-Content-Type': this.file.type || 'application/octet-stream'
    }

    const thumbnailfile = this.metadata.thumbnailfile as any as File
    delete this.metadata.thumbnailfile

    const data = objectToFormData(this.metadata)
    if (thumbnailfile !== undefined) {
      data.append('thumbnailfile', thumbnailfile, thumbnailfile.name)
    }

    await this.request({
      method: 'POST',
      body: data,
      url: this.endpoint,
      headers
    })

    const location = this.getValueFromResponse('location')
    if (!location) {
      throw new Error('Invalid or missing Location header')
    }

    this.offset = this.responseStatus === 201 ? 0 : undefined

    return resolveUrl(location, this.endpoint)
  }
}
