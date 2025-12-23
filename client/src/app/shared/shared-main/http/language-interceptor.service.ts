import { HttpHandlerFn, HttpRequest } from '@angular/common/http'
import { inject, LOCALE_ID } from '@angular/core'
import { getBackendUrl } from '@app/helpers'
import { isSameOrigin } from '@root-helpers/url'

export function languageInterceptor (req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const localeId = inject(LOCALE_ID)

  const sameOrigin = req.url.startsWith('/') || isSameOrigin(getBackendUrl(), req.url)
  if (!sameOrigin) return next(req)

  const newReq = req.clone({ headers: req.headers.append('x-peertube-language', localeId) })

  return next(newReq)
}
