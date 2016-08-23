import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, REACTIVE_FORM_DIRECTIVES } from '@angular/forms';
import { Router } from '@angular/router';

import { validateUrl } from '../../../shared';
import { FriendService } from '../shared';

@Component({
  selector: 'my-friend-add',
  template: require('./friend-add.component.html'),
  styles: [ require('./friend-add.component.scss') ],
  directives: [ REACTIVE_FORM_DIRECTIVES ]
})
export class FriendAddComponent implements OnInit {
  friendAddForm: FormGroup;
  urls = [ ];
  error: string = null;

  constructor(private router: Router, private friendService: FriendService) {}

  ngOnInit() {
    this.friendAddForm = new FormGroup({});
    this.addField();
  }

  addField() {
    this.friendAddForm.addControl(`url-${this.urls.length}`, new FormControl('', [ validateUrl ]));
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

  isFormValid() {
    // Do not check the last input
    for (let i = 0; i < this.urls.length - 1; i++) {
      if (!this.friendAddForm.controls[`url-${i}`].valid) return false;
    }

    const lastIndex = this.urls.length - 1;
    // If the last input (which is not the first) is empty, it's ok
    if (this.urls[lastIndex] === '' && lastIndex !== 0) {
      return true;
    } else {
      return this.friendAddForm.controls[`url-${lastIndex}`].valid;
    }
  }

  removeField(index: number) {
    // Remove the last control
    this.friendAddForm.removeControl(`url-${this.urls.length - 1}`);
    this.urls.splice(index, 1);
  }

  makeFriends() {
    this.error = '';

    const notEmptyUrls = this.getNotEmptyUrls();
    if (notEmptyUrls.length === 0) {
      this.error = 'You need to specify at less 1 url.';
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
          alert('Make friends request sent!');
          this.router.navigate([ '/admin/friends/list' ]);
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

  private isUrlsUnique(urls: string[]) {
    return urls.every(url => urls.indexOf(url) === urls.lastIndexOf(url));
  }
}
