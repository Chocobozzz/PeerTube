import { Injectable } from '@angular/core'
import { Observable } from 'rxjs/Observable'
import { HttpErrorResponse } from '@angular/common/http'

import { Utils } from '../utils'
import { ResultList } from '../../../../../shared'

@Injectable()
export class RestExtractor {

  extractDataBool () {
    return true
  }

  applyToResultListData <T> (result: ResultList<T>, fun: Function, additionalArgs?: any[]): ResultList<T> {
    const data: T[] = result.data
    const newData: T[] = []

    data.forEach(d => newData.push(fun.call(this, d, additionalArgs)))

    return {
      total: result.total,
      data: newData
    }
  }

  convertResultListDateToHuman <T> (result: ResultList<T>, fieldsToConvert: string[] = [ 'createdAt' ]): ResultList<T> {
    return this.applyToResultListData(result, this.convertDateToHuman, [ fieldsToConvert ])
  }

  convertDateToHuman (target: object, fieldsToConvert: string[]) {
    const source = {}
    fieldsToConvert.forEach(field => {
      source[field] = Utils.dateToHuman(target[field])
    })

    return Object.assign(target, source)
  }

  handleError (err: HttpErrorResponse) {
    let errorMessage

    if (err.error instanceof Error) {
      // A client-side or network error occurred. Handle it accordingly.
      errorMessage = err.error.message
      console.error('An error occurred:', errorMessage)
    } else if (err.status !== undefined) {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong,
      errorMessage = err.error
      console.error(`Backend returned code ${err.status}, body was: ${errorMessage}`)
    } else {
      errorMessage = err
    }

    return Observable.throw(errorMessage)
  }
}
