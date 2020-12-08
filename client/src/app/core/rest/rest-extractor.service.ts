import { throwError as observableThrowError } from 'rxjs'
import { Injectable } from '@angular/core'
import { Router } from '@angular/router'
import { dateToHuman } from '@app/helpers'
import { ResultList } from '@shared/models'
import { HttpStatusCode } from '@shared/core-utils/miscs/http-error-codes'

@Injectable()
export class RestExtractor {

  constructor (private router: Router) { }

  extractDataBool () {
    return true
  }

  applyToResultListData <T> (result: ResultList<T>, fun: Function, additionalArgs?: any[]): ResultList<T> {
    const data: T[] = result.data
    const newData: T[] = []

    data.forEach(d => newData.push(fun.apply(this, [ d ].concat(additionalArgs))))

    return {
      total: result.total,
      data: newData
    }
  }

  convertResultListDateToHuman <T> (result: ResultList<T>, fieldsToConvert: string[] = [ 'createdAt' ]): ResultList<T> {
    return this.applyToResultListData(result, this.convertDateToHuman, [ fieldsToConvert ])
  }

  convertDateToHuman (target: { [ id: string ]: string }, fieldsToConvert: string[]) {
    fieldsToConvert.forEach(field => target[field] = dateToHuman(target[field]))

    return target
  }

  handleError (err: any) {
    let errorMessage

    if (err.error instanceof Error) {
      // A client-side or network error occurred. Handle it accordingly.
      errorMessage = err.error.message
      console.error('An error occurred:', errorMessage)
    } else if (typeof err.error === 'string') {
      errorMessage = err.error
    } else if (err.status !== undefined) {
      // A server-side error occurred.
      if (err.error && err.error.errors) {
        const errors = err.error.errors
        const errorsArray: string[] = []

        Object.keys(errors).forEach(key => {
          errorsArray.push(errors[key].msg)
        })

        errorMessage = errorsArray.join('. ')
      } else if (err.error && err.error.error) {
        errorMessage = err.error.error
      } else if (err.status === HttpStatusCode.PAYLOAD_TOO_LARGE_413) {
        errorMessage = $localize`Media is too large for the server. Please contact you administrator if you want to increase the limit size.`
      } else if (err.status === HttpStatusCode.TOO_MANY_REQUESTS_429) {
        const secondsLeft = err.headers.get('retry-after')
        if (secondsLeft) {
          const minutesLeft = Math.floor(parseInt(secondsLeft, 10) / 60)
          errorMessage = $localize`Too many attempts, please try again after ${minutesLeft} minutes.`
        } else {
          errorMessage = $localize`Too many attempts, please try again later.`
        }
      } else if (err.status === HttpStatusCode.INTERNAL_SERVER_ERROR_500) {
        errorMessage = $localize`Server error. Please retry later.`
      }

      errorMessage = errorMessage ? errorMessage : 'Unknown error.'
      console.error(`Backend returned code ${err.status}, errorMessage is: ${errorMessage}`)
    } else {
      console.error(err)
      errorMessage = err
    }

    const errorObj: { message: string, status: string, body: string } = {
      message: errorMessage,
      status: undefined,
      body: undefined
    }

    if (err.status) {
      errorObj.status = err.status
      errorObj.body = err.error
    }

    return observableThrowError(errorObj)
  }

  redirectTo404IfNotFound (obj: { status: number }, status = [ HttpStatusCode.NOT_FOUND_404 ]) {
    if (obj && obj.status && status.indexOf(obj.status) !== -1) {
      // Do not use redirectService to avoid circular dependencies
      this.router.navigate([ '/404' ], { skipLocationChange: true })
    }

    return observableThrowError(obj)
  }
}
