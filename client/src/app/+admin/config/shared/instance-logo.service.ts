import { HttpClient } from '@angular/common/http'
import { Injectable, inject } from '@angular/core'
import { RestExtractor, ServerService } from '@app/core'
import { InstanceService } from '@app/shared/shared-main/instance/instance.service'
import { maxBy } from '@peertube/peertube-core-utils'
import { LogoType } from '@peertube/peertube-models'
import { logger } from '@root-helpers/logger'
import { catchError } from 'rxjs/operators'

@Injectable()
export class InstanceLogoService {
  private authHttp = inject(HttpClient)
  private restExtractor = inject(RestExtractor)
  private server = inject(ServerService)

  updateBanner (banner: Blob) {
    const url = InstanceService.BASE_CONFIG_URL + '/instance-banner/pick'

    const formData = new FormData()
    formData.append('bannerfile', banner)

    return this.authHttp.post(url, formData)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  deleteBanner () {
    const url = InstanceService.BASE_CONFIG_URL + '/instance-banner'

    return this.authHttp.delete(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  updateAvatar (avatar: Blob) {
    const url = InstanceService.BASE_CONFIG_URL + '/instance-avatar/pick'

    const formData = new FormData()
    formData.append('avatarfile', avatar)

    return this.authHttp.post(url, formData)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  deleteAvatar () {
    const url = InstanceService.BASE_CONFIG_URL + '/instance-avatar'

    return this.authHttp.delete(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  updateLogo (logo: Blob, type: LogoType) {
    const url = InstanceService.BASE_CONFIG_URL + '/instance-logo/' + type + '/pick'

    const formData = new FormData()
    formData.append('logofile', logo)

    return this.authHttp.post(url, formData)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  deleteLogo (type: LogoType) {
    const url = InstanceService.BASE_CONFIG_URL + '/instance-logo/' + type

    return this.authHttp.delete(url)
      .pipe(catchError(err => this.restExtractor.handleError(err)))
  }

  // ---------------------------------------------------------------------------

  async getAllLogos () {
    const config = this.server.getHTMLConfig()

    const promises: Promise<any>[] = []
    const result: Partial<Record<LogoType | 'avatar' | 'banner', Blob>> = {}
    const logoTypes: LogoType[] = [ 'favicon', 'header-square', 'header-wide', 'opengraph' ]

    const fetchLogo = (fileUrl: string, type: keyof typeof result) => {
      return fetch(fileUrl)
        .then(response => response.blob())
        .then(blob => result[type] = blob)
        .catch(() => {
          result[type] = null
          logger.error('Could not fetch logo of type: ' + type)
        })
    }

    for (const type of logoTypes) {
      const logo = maxBy(config.instance.logo.filter(l => l.type === type), 'width')
      if (!logo || logo.isFallback === true) {
        result[type] = null
        continue
      }

      const p = fetchLogo(logo.fileUrl, type)

      promises.push(p)
    }

    const avatarFileUrl = maxBy(config.instance.avatars, 'width')?.fileUrl
    if (!avatarFileUrl) {
      result.avatar = null
    } else {
      promises.push(fetchLogo(avatarFileUrl, 'avatar'))
    }

    const bannerFileUrl = maxBy(config.instance.banners, 'width')?.fileUrl
    if (!bannerFileUrl) {
      result.banner = null
    } else {
      promises.push(fetchLogo(bannerFileUrl, 'banner'))
    }

    await Promise.all(promises)

    return result
  }
}
