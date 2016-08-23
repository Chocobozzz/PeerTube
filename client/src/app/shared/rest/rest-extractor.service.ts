import { Injectable } from '@angular/core';
import { Response } from '@angular/http';
import { Observable } from 'rxjs/Observable';

export interface ResultList {
  data: any[];
  total: number;
}

@Injectable()
export class RestExtractor {

  constructor () { ; }

  extractDataBool(res: Response) {
    return true;
  }

  extractDataList(res: Response) {
    const body = res.json();

    const ret: ResultList = {
      data: body.data,
      total: body.total
    };

    return ret;
  }

  extractDataGet(res: Response) {
    return res.json();
  }

  handleError(res: Response) {
    let text = 'Server error: ';
    text += res.text();
    let json = res.json();

    const error = {
      json,
      text
    };

    return Observable.throw(error);
  }
}
