import { Component, ElementRef, OnInit } from '@angular/core';
import { Router } from '@angular/router-deprecated';

import { BytesPipe } from 'angular-pipes/src/math/bytes.pipe';
import { PROGRESSBAR_DIRECTIVES } from 'ng2-bootstrap/components/progressbar';

import { AuthService, User } from '../../users/index';

// TODO: import it with systemjs
declare var jQuery: any;

@Component({
  selector: 'my-videos-add',
  styleUrls: [ 'client/app/videos/video-add/video-add.component.css' ],
  templateUrl: 'client/app/videos/video-add/video-add.component.html',
  directives: [ PROGRESSBAR_DIRECTIVES ],
  pipes: [ BytesPipe ]
})

export class VideoAddComponent implements OnInit {
  user: User;
  fileToUpload: any;
  progressBar: { value: number; max: number; } = { value: 0, max: 0 };

  private _form: any;

  constructor(
    private _router: Router, private _elementRef: ElementRef,
    private _authService: AuthService
  ) {}

  ngOnInit() {
    this.user = User.load();
    jQuery(this._elementRef.nativeElement).find('#videofile').fileupload({
      url: '/api/v1/videos',
      dataType: 'json',
      singleFileUploads: true,
      multipart: true,
      autoupload: false,

      add: (e, data) => {
        this._form = data;
        this.fileToUpload = data['files'][0];
      },

      progressall: (e, data) => {
        this.progressBar.value = data.loaded;
        // The server is a little bit slow to answer (has to seed the video)
        // So we add more time to the progress bar (+10%)
        this.progressBar.max = data.total + (0.1 * data.total);
      },

      done: (e, data) => {
        this.progressBar.value = this.progressBar.max;
        console.log('Video uploaded.');

        // Print all the videos once it's finished
        this._router.navigate(['VideosList']);
      }
    });
  }

  uploadFile() {
    this._form.headers = this._authService.getRequestHeader().toJSON();
    this._form.formData = jQuery(this._elementRef.nativeElement).find('form').serializeArray();
    this._form.submit();
  }
}
