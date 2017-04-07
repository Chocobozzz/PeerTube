import { User } from '../../shared';

export class Video {
  author: string;
  by: string;
  createdAt: Date;
  categoryLabel: string;
  licenceLabel: string;
  languageLabel: string;
  description: string;
  duration: string;
  id: string;
  isLocal: boolean;
  magnetUri: string;
  name: string;
  podHost: string;
  tags: string[];
  thumbnailPath: string;
  views: number;
  likes: number;
  dislikes: number;
  nsfw: boolean;

  private static createByString(author: string, podHost: string) {
    return author + '@' + podHost;
  }

  private static createDurationString(duration: number) {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const minutes_padding = minutes >= 10 ? '' : '0';
    const seconds_padding = seconds >= 10 ? '' : '0';

    return minutes_padding + minutes.toString() + ':' + seconds_padding + seconds.toString();
  }

  constructor(hash: {
    author: string,
    createdAt: string,
    categoryLabel: string,
    licenceLabel: string,
    languageLabel: string;
    description: string,
    duration: number;
    id: string,
    isLocal: boolean,
    magnetUri: string,
    name: string,
    podHost: string,
    tags: string[],
    thumbnailPath: string,
    views: number,
    likes: number,
    dislikes: number,
    nsfw: boolean
  }) {
    this.author  = hash.author;
    this.createdAt = new Date(hash.createdAt);
    this.categoryLabel = hash.categoryLabel;
    this.licenceLabel = hash.licenceLabel;
    this.languageLabel = hash.languageLabel;
    this.description = hash.description;
    this.duration = Video.createDurationString(hash.duration);
    this.id = hash.id;
    this.isLocal = hash.isLocal;
    this.magnetUri = hash.magnetUri;
    this.name = hash.name;
    this.podHost = hash.podHost;
    this.tags = hash.tags;
    this.thumbnailPath = hash.thumbnailPath;
    this.views = hash.views;
    this.likes = hash.likes;
    this.dislikes = hash.dislikes;
    this.nsfw = hash.nsfw;

    this.by = Video.createByString(hash.author, hash.podHost);
  }

  isRemovableBy(user: User) {
    return this.isLocal === true && user && this.author === user.username;
  }

  isVideoNSFWForUser(user: User) {
    // If the video is NSFW and the user is not logged in, or the user does not want to display NSFW videos...
    return (this.nsfw && (!user || user.displayNSFW === false));
  }
}
