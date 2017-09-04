import { Http, RequestOptionsArgs, URLSearchParams, Response } from '@angular/http'

import { ServerDataSource } from 'ng2-smart-table'

export class RestDataSource extends ServerDataSource {
  private updateResponse: (input: any[]) => any[]

  constructor (http: Http, endpoint: string, updateResponse?: (input: any[]) => any[]) {
    const options = {
      endPoint: endpoint,
      sortFieldKey: 'sort',
      dataKey: 'data'
    }
    super(http, options)

    if (updateResponse) {
      this.updateResponse = updateResponse
    }
  }

  protected extractDataFromResponse (res: Response) {
    const json = res.json()
    if (!json) return []
    let data = json.data

    if (this.updateResponse !== undefined) {
      data = this.updateResponse(data)
    }

    return data
  }

  protected extractTotalFromResponse (res: Response) {
    const rawData = res.json()
    return rawData ? parseInt(rawData.total, 10) : 0
  }

  protected addSortRequestOptions (requestOptions: RequestOptionsArgs) {
    const searchParams = requestOptions.params as URLSearchParams

    if (this.sortConf) {
      this.sortConf.forEach((fieldConf) => {
        const sortPrefix = fieldConf.direction === 'desc' ? '-' : ''

        searchParams.set(this.conf.sortFieldKey, sortPrefix + fieldConf.field)
      })
    }

    return requestOptions
  }

  protected addPagerRequestOptions (requestOptions: RequestOptionsArgs) {
    const searchParams = requestOptions.params as URLSearchParams

    if (this.pagingConf && this.pagingConf['page'] && this.pagingConf['perPage']) {
      const perPage = this.pagingConf['perPage']
      const page = this.pagingConf['page']

      const start = (page - 1) * perPage
      const count = perPage

      searchParams.set('start', start.toString())
      searchParams.set('count', count.toString())
    }

    return requestOptions
  }
}
