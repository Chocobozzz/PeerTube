import { uniq } from 'lodash-es'
import { Observable } from 'rxjs'
import { bufferTime, distinctUntilChanged, filter, map, share, switchMap } from 'rxjs/operators'

function buildBulkObservable <T extends number | string, R> (options: {
  notifierObservable: Observable<T>
  time: number
  bulkGet: (params: T[]) => Observable<R>
}) {
  const { notifierObservable, time, bulkGet } = options

  return notifierObservable.pipe(
    distinctUntilChanged(),
    bufferTime(time),
    filter(params => params.length !== 0),
    map(params => uniq(params)),
    switchMap(params => bulkGet(params)),
    share()
  )
}

export {
  buildBulkObservable
}
