import { HttpHandlerFn, HttpRequest } from '@angular/common/http'
import { inject, LOCALE_ID } from '@angular/core'

export function languageInterceptor (req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const localeId = inject(LOCALE_ID)

  const newReq = req.clone({ headers: req.headers.append('x-peertube-language', localeId) })

  return next(newReq)
}
