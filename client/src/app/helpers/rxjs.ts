import { uniq } from 'lodash-es'
import { asyncScheduler, Observable } from 'rxjs'
import { bufferTime, distinctUntilChanged, filter, map, observeOn, share, switchMap } from 'rxjs/operators'
import { NgZone } from '@angular/core'
import { enterZone, leaveZone } from './zone'

function buildBulkObservable <T extends number | string, R> (options: {
  ngZone: NgZone
  notifierObservable: Observable<T>
  time: number
  bulkGet: (params: T[]) => Observable<R>
}) {
  const { ngZone, notifierObservable, time, bulkGet } = options

  return notifierObservable.pipe(
    distinctUntilChanged(),
    // We leave Angular zone so Protractor does not get stuck
    bufferTime(time, leaveZone(ngZone, asyncScheduler)),
    filter(params => params.length !== 0),
    map(params => uniq(params)),
    observeOn(enterZone(ngZone, asyncScheduler)),
    switchMap(params => bulkGet(params)),
    share()
  )
}

export {
  buildBulkObservable
}
