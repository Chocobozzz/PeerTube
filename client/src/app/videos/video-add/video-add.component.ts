import { Control, ControlGroup, Validators } from '@angular/common';
import { Component, ElementRef, OnInit } from '@angular/core';
import { Router } from '@angular/router-deprecated';

import { BytesPipe } from 'angular-pipes/src/math/bytes.pipe';
import { PROGRESSBAR_DIRECTIVES } from 'ng2-bootstrap/components/progressbar';
import { FileSelectDirective, FileUploader } from 'ng2-file-upload/ng2-file-upload';

import { AuthService } from '../../shared';

@Component({
  selector: 'my-videos-add',
  styles: [ require('./video-add.component.scss') ],
  template: require('./video-add.component.html'),
  directives: [ FileSelectDirective, PROGRESSBAR_DIRECTIVES ],
  pipes: [ BytesPipe ]
})

export class VideoAddComponent implements OnInit {
  currentTag: string; // Tag the user is writing in the input
  error: string = null;
  videoForm: ControlGroup;
  uploader: FileUploader;
  video = {
    name: '',
    tags: [],
    description: ''
  };

  constructor(
    private authService: AuthService,
    private elementRef: ElementRef,
    private router: Router
  ) {}

  get filename() {
    if (this.uploader.queue.length === 0) {
      return null;
    }

    return this.uploader.queue[0].file.name;
  }

  get isTagsInputDisabled () {
    return this.video.tags.length >= 3;
  }

  getInvalidFieldsTitle() {
    let title = '';
    const nameControl = this.videoForm.controls['name'];
    const descriptionControl = this.videoForm.controls['description'];

    if (!nameControl.valid) {
      title += 'A name is required\n';
    }

    if (this.video.tags.length === 0) {
      title += 'At least one tag is required\n';
    }

    if (this.filename === null) {
      title += 'A file is required\n';
    }

    if (!descriptionControl.valid) {
      title += 'A description is required\n';
    }

    return title;
  }

  ngOnInit() {
    this.videoForm = new ControlGroup({
      name: new Control('', Validators.compose([ Validators.required, Validators.minLength(3), Validators.maxLength(50) ])),
      description: new Control('', Validators.compose([ Validators.required, Validators.minLength(3), Validators.maxLength(250) ])),
      tags: new Control('', Validators.pattern('^[a-zA-Z0-9]{2,10}$'))
    });


    this.uploader = new FileUploader({
      authToken: this.authService.getRequestHeaderValue(),
      queueLimit: 1,
      url: '/api/v1/videos',
      removeAfterUpload: true
    });

    this.uploader.onBuildItemForm = (item, form) => {
      form.append('name', this.video.name);
      form.append('description', this.video.description);

      for (let i = 0; i < this.video.tags.length; i++) {
        form.append(`tags[${i}]`, this.video.tags[i]);
      }
    };
  }

  onTagKeyPress(event: KeyboardEvent) {
    // Enter press
    if (event.keyCode === 13) {
      // Check if the tag is valid and does not already exist
      if (
        this.currentTag !== '' &&
        this.videoForm.controls['tags'].valid &&
        this.video.tags.indexOf(this.currentTag) === -1
      ) {
        this.video.tags.push(this.currentTag);
        this.currentTag = '';
      }
    }
  }

  removeFile() {
    this.uploader.clearQueue();
  }

  removeTag(tag: string) {
    this.video.tags.splice(this.video.tags.indexOf(tag), 1);
  }

  upload() {
    const item = this.uploader.queue[0];
    // TODO: wait for https://github.com/valor-software/ng2-file-upload/pull/242
    item.alias = 'videofile';

    item.onSuccess = () => {
      console.log('Video uploaded.');

      // Print all the videos once it's finished
      this.router.navigate(['VideosList']);
    };

    item.onError = (response: string, status: number) => {
      this.error = (status === 400) ? response : 'Unknow error';
      console.error(this.error);
    };


    this.uploader.uploadAll();
  }
}
