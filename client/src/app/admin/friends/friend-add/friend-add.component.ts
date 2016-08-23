import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { FriendService } from '../shared';

@Component({
  selector: 'my-friend-add',
  template: require('./friend-add.component.html'),
  styles: [ require('./friend-add.component.scss') ]
})
export class FriendAddComponent {
  urls = [ '' ];
  error: string = null;

  constructor(private router: Router, private friendService: FriendService) {}

  addField() {
    this.urls.push('');
  }

  customTrackBy(index: number, obj: any): any {
    return index;
  }

  displayAddField(index: number) {
    return index === (this.urls.length - 1);
  }

  displayRemoveField(index: number) {
    return (index !== 0 || this.urls.length > 1) && index !== (this.urls.length - 1);
  }

  removeField(index: number) {
    this.urls.splice(index, 1);
  }

  makeFriends() {
    this.error = '';

    const notEmptyUrls = this.getNotEmptyUrls();
    if (notEmptyUrls.length === 0) {
      this.error = 'You need to specify at less 1 url.';
      return;
    }

    if (!this.isUrlsRegexValid(notEmptyUrls)) {
      this.error = 'Some url(s) are not valid.';
      return;
    }

    if (!this.isUrlsUnique(notEmptyUrls)) {
      this.error = 'Urls need to be unique.';
      return;
    }

    const confirmMessage = 'Are you sure to make friends with:\n - ' + notEmptyUrls.join('\n - ');
    if (!confirm(confirmMessage)) return;

    this.friendService.makeFriends(notEmptyUrls).subscribe(
      status => {
        if (status === 409) {
          alert('Already made friends!');
        } else {
          alert('Made friends!');
        }
      },
      error => alert(error)
    );
  }

  private getNotEmptyUrls() {
    const notEmptyUrls = [];

    this.urls.forEach((url) => {
      if (url !== '') notEmptyUrls.push(url);
    });

    return notEmptyUrls;
  }

  // Temporary
  // Use HTML validators
  private isUrlsRegexValid(urls: string[]) {
    let res = true;

    const urlRegex = new RegExp('^https?://(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$');
    urls.forEach((url) => {
      if (urlRegex.test(url) === false) {
        res = false;
      }
    });

    return res;
  }

  private isUrlsUnique(urls: string[]) {
    return urls.every(url => urls.indexOf(url) === urls.lastIndexOf(url));
  }
}
