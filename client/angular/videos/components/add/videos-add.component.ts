import { Component, ElementRef, Inject, OnInit } from 'angular2/core';
import { Router } from 'angular2/router';
import { NgForm } from 'angular2/common';

import { Video } from '../../models/video';

// TODO: import it with systemjs
declare var jQuery:any;

@Component({
  selector: 'my-videos-add',
  styleUrls: [ 'app/angular/videos/components/add/videos-add.component.css' ],
  templateUrl: 'app/angular/videos/components/add/videos-add.component.html'
})

export class VideosAddComponent implements OnInit {
  fileToUpload: any;
  progressBar: { value: number; max: number; } = { value: 0, max: 0 };

  private _form: any;

  constructor(private _router: Router, private _elementRef: ElementRef) {}

  ngOnInit() {
    jQuery(this._elementRef.nativeElement).find('#input_video').fileupload({
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
        this.progressBar.max = data.total;
      },

      done: (e, data) => {
        console.log('Video uploaded.');

        // Print all the videos once it's finished
        this._router.navigate(['VideosList']);
      }
    });
  }

  uploadFile() {
    this._form.formData = jQuery(this._elementRef.nativeElement).find('form').serializeArray();
    this._form.submit();
  }
}
