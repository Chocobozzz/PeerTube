import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ComponentPagination } from "@app/core";
import { GlobalIconComponent } from "../../../../shared/shared-icons/global-icon.component";
import { InfiniteScrollerDirective } from "../../../../shared/shared-main/common/infinite-scroller.directive";
import { NgbTooltip } from "@ng-bootstrap/ng-bootstrap";
import { NgIf, NgClass, NgFor } from "@angular/common";
import { VideoDetails } from "@app/shared/shared-main/video/video-details.model";
import { PTDatePipe } from "@app/shared/shared-main/common/date.pipe";
import { interval, Subscription } from "rxjs";
import { SubscribeButtonComponent } from "@app/shared/shared-user-subscription/subscribe-button.component";

@Component({
  selector: "my-video-premiere",
  templateUrl: "./video-premiere.component.html",
  styleUrls: ["./video-premiere.component.scss"],
  standalone: true,
  imports: [
    NgIf,
    InfiniteScrollerDirective,
    NgClass,
    NgbTooltip,
    GlobalIconComponent,
    SubscribeButtonComponent,
    NgFor,
    PTDatePipe,
  ],
})
export class VideoPremiereComponent {
  @Input() video: VideoDetails;
  autoPlayNextPremiere: boolean;
  autoPlayNextPremiereSwitchText = "";

  loopPremiere: boolean;
  loopPremiereSwitchText = "";

  notificationAdded = false;
  currentPremierePosition: number;

  remainingTime: string = "";
  private countdownSubscription!: Subscription;

  ngOnInit(): void {
    this.startCountdown();
  }

  ngOnDestroy(): void {
    this.countdownSubscription?.unsubscribe();
  }

  startCountdown(): void {
    this.countdownSubscription = interval(1000).subscribe(() => {
      const now = new Date().getTime();
      const premiereTime = new Date(
        this.video.scheduledUpdate.updateAt
      ).getTime();
      const diff = premiereTime - now;

      if (diff <= 0) {
        this.remainingTime = "Premiere has started!";
        this.countdownSubscription.unsubscribe();
      } else {
        const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
        const days = Math.floor(
          (diff % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24)
        );
        const hours = Math.floor(
          (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        this.remainingTime = `${years > 0 ? years + "y " : ""}${
          days > 0 ? days + "d " : ""
        }${hours}h ${minutes}m ${seconds}s`;
      }
    });
  }
}
