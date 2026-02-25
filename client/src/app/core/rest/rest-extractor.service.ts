import { HttpHeaderResponse } from '@angular/common/http'
import { Injectable, LOCALE_ID, inject } from '@angular/core'
import { Router } from '@angular/router'
import { DateFormat, dateToHuman } from '@app/helpers'
import { HttpStatusCode, HttpStatusCodeType, ResultList } from '@peertube/peertube-models'
import { PeerTubeHTTPError, PeerTubeReconnectError } from '@root-helpers/errors'
import { throwError as observableThrowError } from 'rxjs'

@Injectable()
export class RestExtractor {
  private localeId = inject(LOCALE_ID)
  private router = inject(Router)

  applyToResultListData<T, A, U> (
    result: ResultList<T>,
    fun: (data: T, ...args: A[]) => U,
    additionalArgs: A[] = []
  ): ResultList<U> {
    const data: T[] = result.data

    return {
      total: result.total,
      data: data.map(d => fun.apply(this, [ d, ...additionalArgs ]))
    }
  }

  convertResultListDateToHuman<T> (
    result: ResultList<T>,
    fieldsToConvert: string[] = [ 'createdAt' ],
    format?: DateFormat
  ): ResultList<T> {
    return this.applyToResultListData(result, this.convertDateToHuman.bind(this), [ fieldsToConvert, format ])
  }

  convertDateToHuman (target: any, fieldsToConvert: string[], format?: DateFormat) {
    fieldsToConvert.forEach(field => {
      if (!target[field]) return

      target[field] = dateToHuman(this.localeId, new Date(target[field]), format)
    })

    return target
  }

  redirectTo404IfNotFound (
    obj: { status: HttpStatusCodeType },
    type: 'video' | 'other',
    status: HttpStatusCodeType[] = [ HttpStatusCode.NOT_FOUND_404 ]
  ) {
    if (obj?.status && status.includes(obj.status)) {
      // Do not use redirectService to avoid circular dependencies
      this.router.navigate([ '/404' ], { state: { type, obj }, skipLocationChange: true })
    }

    return observableThrowError(() => obj)
  }

  handleError (err: any) {
    const errorMessage = this.buildErrorMessage(err)

    const errorObj: { message: string, status: string, body: string, headers: HttpHeaderResponse } = {
      message: errorMessage,
      status: undefined,
      body: undefined,
      headers: err.headers
    }

    if (err.status) {
      errorObj.status = err.status
      errorObj.body = err.error
    }

    return observableThrowError(() => {
      if (err instanceof PeerTubeReconnectError) {
        return err
      }

      if (err.status) {
        return new PeerTubeHTTPError(errorMessage, {
          status: err.status,
          body: errorObj.body,
          headers: errorObj.headers,
          url: err.url
        })
      }

      return err
    })
  }

  private buildErrorMessage (err: any) {
    if (err.error instanceof Error) return err.error.detail || err.error.title
    if (typeof err.error === 'string') return err.error
    if (err.status !== undefined) return this.buildServerErrorMessage(err)
    if (typeof err === 'string') return err

    return err.message || err.detail || $localize`Unknown error`
  }

  private buildServerErrorMessage (err: any) {
    // A server-side error occurred.
    if (err.error?.errors) {
      const errors = err.error.errors

      return Object.keys(errors)
        .map(key => errors[key].msg)
        .join('. ')
    }

    if (err.status === HttpStatusCode.PAYLOAD_TOO_LARGE_413) {
      return $localize`Media is too large for the server. Please contact you administrator if you want to increase the limit size.`
    }

    if (err.status === HttpStatusCode.TOO_MANY_REQUESTS_429) {
      const secondsLeft = err.headers.get('retry-after')

      if (secondsLeft) {
        const minutesLeft = Math.floor(parseInt(secondsLeft, 10) / 60)
        return $localize`Too many attempts, please try again after ${minutesLeft} minutes.`
      }

      return $localize`Too many attempts, please try again later.`
    }

    if (err.status === HttpStatusCode.INTERNAL_SERVER_ERROR_500) {
      return $localize`Server error. Please retry later.`
    }

    if (err.status === HttpStatusCode.BAD_GATEWAY_502) {
      return $localize`Server is unavailable. Please retry later.`
    }

    return err.error?.error || err.error?.detail || err.error?.title || $localize`Unknown server error`
  }
}
