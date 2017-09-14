export class RestDataSource  {
  // protected addSortRequestOptions (requestOptions: RequestOptionsArgs) {
  //   const searchParams = requestOptions.params as URLSearchParams
  //
  //   if (this.sortConf) {
  //     this.sortConf.forEach((fieldConf) => {
  //       const sortPrefix = fieldConf.direction === 'desc' ? '-' : ''
  //
  //       searchParams.set(this.conf.sortFieldKey, sortPrefix + fieldConf.field)
  //     })
  //   }
  //
  //   return requestOptions
  // }
  //
  // protected addPagerRequestOptions (requestOptions: RequestOptionsArgs) {
  //   const searchParams = requestOptions.params as URLSearchParams
  //
  //   if (this.pagingConf && this.pagingConf['page'] && this.pagingConf['perPage']) {
  //     const perPage = this.pagingConf['perPage']
  //     const page = this.pagingConf['page']
  //
  //     const start = (page - 1) * perPage
  //     const count = perPage
  //
  //     searchParams.set('start', start.toString())
  //     searchParams.set('count', count.toString())
  //   }
  //
  //   return requestOptions
  // }
}
