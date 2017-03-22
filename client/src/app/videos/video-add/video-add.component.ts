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
  VIDEO_DESCRIPTION,
  VIDEO_TAGS
} from '../../shared';
import { VideoService } from '../shared';

@Component({
  selector: 'my-videos-add',
  styleUrls: [ './video-add.component.scss' ],
  templateUrl: './video-add.component.html'
})

export class VideoAddComponent extends FormReactive implements OnInit {
  tags: string[] = [];
  uploader: FileUploader;
  videoCategories = [];

  error: string = null;
  form: FormGroup;
  formErrors = {
    name: '',
    category: '',
    description: '',
    currentTag: ''
  };
  validationMessages = {
    name: VIDEO_NAME.MESSAGES,
    category: VIDEO_CATEGORY.MESSAGES,
    description: VIDEO_DESCRIPTION.MESSAGES,
    currentTag: VIDEO_TAGS.MESSAGES
  };

  // Special error messages
  tagsError = '';
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
      category: [ '', VIDEO_CATEGORY.VALIDATORS ],
      description: [ '', VIDEO_DESCRIPTION.VALIDATORS ],
      currentTag: [ '', VIDEO_TAGS.VALIDATORS ]
    });

    this.form.valueChanges.subscribe(data => this.onValueChanged(data));
  }

  ngOnInit() {
    this.videoCategories = this.videoService.videoCategories;

    this.uploader = new FileUploader({
      authToken: this.authService.getRequestHeaderValue(),
      queueLimit: 1,
      url: '/api/v1/videos',
      removeAfterUpload: true
    });

    this.uploader.onBuildItemForm = (item, form) => {
      const name = this.form.value['name'];
      const category = this.form.value['category'];
      const description = this.form.value['description'];

      form.append('name', name);
      form.append('category', category);
      form.append('description', description);

      for (let i = 0; i < this.tags.length; i++) {
        form.append(`tags[${i}]`, this.tags[i]);
      }
    };

    this.buildForm();
  }

  checkForm() {
    this.forceCheck();

    if (this.filename === null) {
      this.fileError = 'You did not add a file.';
    }

    return this.form.valid === true && this.tagsError === '' && this.fileError === '';
  }

  fileChanged() {
    this.fileError = '';
  }

  onTagKeyPress(event: KeyboardEvent) {
    // Enter press
    if (event.keyCode === 13) {
      this.addTagIfPossible();
    }
  }

  removeFile() {
    this.uploader.clearQueue();
  }

  removeTag(tag: string) {
    this.tags.splice(this.tags.indexOf(tag), 1);
    this.form.get('currentTag').enable();
  }

  upload() {
    // Maybe the user forgot to press "enter" when he filled the field
    this.addTagIfPossible();

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

  private addTagIfPossible() {
    const currentTag = this.form.value['currentTag'];
    if (currentTag === undefined) return;

    // Check if the tag is valid and does not already exist
    if (
      currentTag.length >= 2 &&
      this.form.controls['currentTag'].valid &&
      this.tags.indexOf(currentTag) === -1
    ) {
      this.tags.push(currentTag);
      this.form.patchValue({ currentTag: '' });

      if (this.tags.length >= 3) {
        this.form.get('currentTag').disable();
      }

      this.tagsError = '';
    }
  }
}
