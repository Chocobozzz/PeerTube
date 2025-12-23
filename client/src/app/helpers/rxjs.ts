import { uniq } from 'lodash-es'
import { Observable } from 'rxjs'
import { buffer, debounceTime, distinctUntilChanged, filter, map, share, switchMap } from 'rxjs/operators'

function buildBulkObservable <P extends number | string, R> (options: {
  notifierObservable: Observable<P>
  time: number
  bulkGet: (params: P[]) => Observable<R>
}) {
  const { notifierObservable, time, bulkGet } = options

  return notifierObservable.pipe(
    distinctUntilChanged(),
    buffer(notifierObservable.pipe(debounceTime(time))),
    filter(params => params.length !== 0),
    map(params => uniq(params)),
    switchMap(params => {
      return bulkGet(params)
        .pipe(map(response => ({ params, response })))
    }),
    share()
  )
}

export {
  buildBulkObservable
}
