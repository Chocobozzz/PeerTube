import { HttpErrorResponse } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { dateToHuman } from '@app/shared/misc/utils'
import { Observable } from 'rxjs/Observable'
import { ResultList } from '../../../../../shared'

@Injectable()
export class RestExtractor {

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

  convertDateToHuman (target: object, fieldsToConvert: string[]) {
    fieldsToConvert.forEach(field => target[field] = dateToHuman(target[field]))

    return target
  }

  handleError (err: HttpErrorResponse) {
    let errorMessage

    if (err.error instanceof Error) {
      // A client-side or network error occurred. Handle it accordingly.
      errorMessage = err.error.message
      console.error('An error occurred:', errorMessage)
    } else if (err.status !== undefined) {
      // A server-side error occurred.
      if (err.error) {
        if (err.error.errors) {
          const errors = err.error.errors
          const errorsArray: string[] = []

          Object.keys(errors).forEach(key => {
            errorsArray.push(errors[key].msg)
          })

          errorMessage = errorsArray.join('. ')
        } else if (err.error.error) {
          errorMessage = err.error.error
        }
      } else if (err.status === 413) {
        errorMessage = 'Request is too large for the server. Please contact you administrator if you want to increase the limit size.'
      }

      errorMessage = errorMessage ? errorMessage : 'Unknown error.'
      console.error(`Backend returned code ${err.status}, body was: ${errorMessage}`)
    } else {
      errorMessage = err
    }

    const errorObj = {
      message: errorMessage,
      status: undefined,
      body: undefined
    }

    if (err.status) {
      errorObj.status = err.status
      errorObj.body = err.error
    }

    return Observable.throw(errorObj)
  }
}
