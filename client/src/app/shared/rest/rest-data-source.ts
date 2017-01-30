import { Http, RequestOptionsArgs, URLSearchParams,  } from '@angular/http';

import { ServerDataSource } from 'ng2-smart-table';

export class RestDataSource extends ServerDataSource {
 constructor(http: Http, endpoint: string) {
   const options = {
     endPoint: endpoint,
     sortFieldKey: 'sort',
     dataKey: 'data'
   }

   super(http, options);
 }

 protected extractTotalFromResponse(res) {
    const rawData = res.json();
    return rawData ? parseInt(rawData.total): 0;
  }

 protected addSortRequestOptions(requestOptions: RequestOptionsArgs) {
    let searchParams: URLSearchParams = <URLSearchParams> requestOptions.search;

    if (this.sortConf) {
      this.sortConf.forEach((fieldConf) => {
        const sortPrefix = fieldConf.direction === 'desc' ? '-' : '';

        searchParams.set(this.conf.sortFieldKey, sortPrefix + fieldConf.field);
      });
    }

    return requestOptions;
  }

  protected addPagerRequestOptions(requestOptions: RequestOptionsArgs) {
    let searchParams: URLSearchParams = <URLSearchParams> requestOptions.search;

    if (this.pagingConf && this.pagingConf['page'] && this.pagingConf['perPage']) {
      const perPage = this.pagingConf['perPage'];
      const page = this.pagingConf['page'];

      const start = (page - 1) * perPage;
      const count = perPage;

      searchParams.set('start', start.toString());
      searchParams.set('count', count.toString());
    }

    return requestOptions;
  }
}
