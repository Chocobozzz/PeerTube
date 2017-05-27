export class Blacklist {
  id: number;
  videoId: string;
  createdAt: Date;

  constructor(hash: {
    id: number,
    videoId: string,
    createdAt: Date,
  }) {
    this.id = hash.id;
    this.videoId = hash.videoId;

    if (hash.createdAt) {
      this.createdAt = hash.createdAt;
    }
  }
}
