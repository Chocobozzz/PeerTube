"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const abstract_scheduler_1 = require("./abstract-scheduler");
const initializers_1 = require("../../initializers");
const youtube_dl_1 = require("../../helpers/youtube-dl");
class YoutubeDlUpdateScheduler extends abstract_scheduler_1.AbstractScheduler {
    constructor() {
        super();
        this.schedulerIntervalMs = initializers_1.SCHEDULER_INTERVALS_MS.youtubeDLUpdate;
    }
    execute() {
        return youtube_dl_1.updateYoutubeDLBinary();
    }
    static get Instance() {
        return this.instance || (this.instance = new this());
    }
}
exports.YoutubeDlUpdateScheduler = YoutubeDlUpdateScheduler;
//# sourceMappingURL=youtube-dl-update-scheduler.js.map