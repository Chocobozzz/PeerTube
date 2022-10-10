import { throwError as observableThrowError } from 'rxjs'
import { Inject, Injectable, LOCALE_ID } from '@angular/core'
import { Router } from '@angular/router'
import { DateFormat, dateToHuman } from '@app/helpers'
import { logger } from '@root-helpers/logger'
import { HttpStatusCode, ResultList } from '@shared/models'
import { HttpHeaderResponse } from '@angular/common/http'

@Injectable()
export class RestExtractor {

  constructor (
    @Inject(LOCALE_ID) private localeId: string,
    private router: Router
  ) { }

  applyToResultListData <T, A, U> (
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

  convertResultListDateToHuman <T> (
    result: ResultList<T>,
    fieldsToConvert: string[] = [ 'createdAt' ],
    format?: DateFormat
  ): ResultList<T> {
    return this.applyToResultListData(result, this.convertDateToHuman, [ fieldsToConvert, format ])
  }

  convertDateToHuman (target: any, fieldsToConvert: string[], format?: DateFormat) {
    fieldsToConvert.forEach(field => {
      target[field] = dateToHuman(this.localeId, new Date(target[field]), format)
    })

    return target
  }

  redirectTo404IfNotFound (obj: { status: number }, type: 'video' | 'other', status = [ HttpStatusCode.NOT_FOUND_404 ]) {
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

    return observableThrowError(() => errorObj)
  }

  private buildErrorMessage (err: any) {
    if (err.error instanceof Error) {
      // A client-side or network error occurred. Handle it accordingly.
      const errorMessage = err.error.detail || err.error.title
      logger.error('An error occurred:', errorMessage)

      return errorMessage
    }

    if (typeof err.error === 'string') {
      return err.error
    }

    if (err.status !== undefined) {
      const errorMessage = this.buildServerErrorMessage(err)
      logger.error(`Backend returned code ${err.status}, errorMessage is: ${errorMessage}`)

      return errorMessage
    }

    logger.error(err)
    return err
  }

  private buildServerErrorMessage (err: any) {
    // A server-side error occurred.
    if (err.error?.errors) {
      const errors = err.error.errors

      return Object.keys(errors)
        .map(key => errors[key].msg)
        .join('. ')
    }

    if (err.error?.error) {
      return err.error.error
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

    return $localize`Unknown server error`
  }
}
