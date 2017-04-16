import { Component, ElementRef, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';

import { FileUploader } from 'ng2-file-upload/ng2-file-upload';
import { NotificationsService } from 'angular2-notifications';

import { AuthService } from '../../core';
import {
  FormReactive,
  VIDEO_NAME,
  VIDEO_CATEGORY,
  VIDEO_LICENCE,
  VIDEO_LANGUAGE,
  VIDEO_DESCRIPTION,
  VIDEO_TAGS
} from '../../shared';
import { VideoService } from '../shared';

@Component({
  selector: 'my-videos-add',
  styleUrls: [ './video-edit.component.scss' ],
  templateUrl: './video-add.component.html'
})

export class VideoAddComponent extends FormReactive implements OnInit {
  tags: string[] = [];
  uploader: FileUploader;
  videoCategories = [];
  videoLicences = [];
  videoLanguages = [];

  tagValidators = VIDEO_TAGS.VALIDATORS;
  tagValidatorsMessages = VIDEO_TAGS.MESSAGES;

  error: string = null;
  form: FormGroup;
  formErrors = {
    name: '',
    category: '',
    licence: '',
    language: '',
    description: ''
  };
  validationMessages = {
    name: VIDEO_NAME.MESSAGES,
    category: VIDEO_CATEGORY.MESSAGES,
    licence: VIDEO_LICENCE.MESSAGES,
    language: VIDEO_LANGUAGE.MESSAGES,
    description: VIDEO_DESCRIPTION.MESSAGES
  };

  // Special error messages
  fileError = '';

  constructor(
    private authService: AuthService,
    private elementRef: ElementRef,
    private formBuilder: FormBuilder,
    private router: Router,
    private notificationsService: NotificationsService,
    private videoService: VideoService
  ) {
    super();
  }

  get filename() {
    if (this.uploader.queue.length === 0) {
      return null;
    }

    return this.uploader.queue[0].file.name;
  }

  buildForm() {
    this.form = this.formBuilder.group({
      name: [ '', VIDEO_NAME.VALIDATORS ],
      nsfw: [ false ],
      category: [ '', VIDEO_CATEGORY.VALIDATORS ],
      licence: [ '', VIDEO_LICENCE.VALIDATORS ],
      language: [ '', VIDEO_LANGUAGE.VALIDATORS ],
      description: [ '', VIDEO_DESCRIPTION.VALIDATORS ],
      tags: [ '']
    });

    this.form.valueChanges.subscribe(data => this.onValueChanged(data));
  }

  ngOnInit() {
    this.videoCategories = this.videoService.videoCategories;
    this.videoLicences = this.videoService.videoLicences;
    this.videoLanguages = this.videoService.videoLanguages;

    this.uploader = new FileUploader({
      authToken: this.authService.getRequestHeaderValue(),
      queueLimit: 1,
      url: '/api/v1/videos',
      removeAfterUpload: true
    });

    this.uploader.onBuildItemForm = (item, form) => {
      const name = this.form.value['name'];
      const nsfw = this.form.value['nsfw'];
      const category = this.form.value['category'];
      const licence = this.form.value['licence'];
      const language = this.form.value['language'];
      const description = this.form.value['description'];
      const tags = this.form.value['tags'];

      form.append('name', name);
      form.append('category', category);
      form.append('nsfw', nsfw);
      form.append('licence', licence);

      // Language is optional
      if (language) {
        form.append('language', language);
      }

      form.append('description', description);

      for (let i = 0; i < tags.length; i++) {
        form.append(`tags[${i}]`, tags[i]);
      }
    };

    this.buildForm();
  }

  checkForm() {
    this.forceCheck();

    if (this.filename === null) {
      this.fileError = 'You did not add a file.';
    }

    return this.form.valid === true && this.fileError === '';
  }

  fileChanged() {
    this.fileError = '';
  }

  removeFile() {
    this.uploader.clearQueue();
  }

  upload() {
    if (this.checkForm() === false) {
      return;
    }

    const item = this.uploader.queue[0];
    // TODO: wait for https://github.com/valor-software/ng2-file-upload/pull/242
    item.alias = 'videofile';

    // FIXME: remove
    // Run detection change for progress bar
    const interval = setInterval(() => { ; }, 250);

    item.onSuccess = () => {
      clearInterval(interval);

      console.log('Video uploaded.');
      this.notificationsService.success('Success', 'Video uploaded.');


      // Print all the videos once it's finished
      this.router.navigate(['/videos/list']);
    };

    item.onError = (response: string, status: number) => {
      clearInterval(interval);

      // We need to handle manually these cases beceause we use the FileUpload component
      if (status === 400) {
        this.error = response;
      } else if (status === 401) {
        this.error = 'Access token was expired, refreshing token...';
        this.authService.refreshAccessToken().subscribe(
          () => {
            // Update the uploader request header
            this.uploader.authToken = this.authService.getRequestHeaderValue();
            this.error += ' access token refreshed. Please retry your request.';
          }
        );
      } else {
        this.error = 'Unknow error';
        console.error(this.error);
      }
    };

    this.uploader.uploadAll();
  }
}
