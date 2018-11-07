"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../../helpers/logger");
const abstract_scheduler_1 = require("./abstract-scheduler");
const schedule_video_update_1 = require("../../models/video/schedule-video-update");
const database_utils_1 = require("../../helpers/database-utils");
const activitypub_1 = require("../activitypub");
const initializers_1 = require("../../initializers");
const videos_1 = require("../../../shared/models/videos");
class UpdateVideosScheduler extends abstract_scheduler_1.AbstractScheduler {
    constructor() {
        super();
        this.schedulerIntervalMs = initializers_1.SCHEDULER_INTERVALS_MS.updateVideos;
        this.isRunning = false;
    }
    execute() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRunning === true)
                return;
            this.isRunning = true;
            try {
                yield database_utils_1.retryTransactionWrapper(this.updateVideos.bind(this));
            }
            catch (err) {
                logger_1.logger.error('Cannot execute update videos scheduler.', { err });
            }
            finally {
                this.isRunning = false;
            }
        });
    }
    updateVideos() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield schedule_video_update_1.ScheduleVideoUpdateModel.areVideosToUpdate()))
                return undefined;
            return initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
                const schedules = yield schedule_video_update_1.ScheduleVideoUpdateModel.listVideosToUpdate(t);
                for (const schedule of schedules) {
                    const video = schedule.Video;
                    logger_1.logger.info('Executing scheduled video update on %s.', video.uuid);
                    if (schedule.privacy) {
                        const oldPrivacy = video.privacy;
                        const isNewVideo = oldPrivacy === videos_1.VideoPrivacy.PRIVATE;
                        video.privacy = schedule.privacy;
                        if (isNewVideo === true)
                            video.publishedAt = new Date();
                        yield video.save({ transaction: t });
                        yield activitypub_1.federateVideoIfNeeded(video, isNewVideo, t);
                    }
                    yield schedule.destroy({ transaction: t });
                }
            }));
        });
    }
    static get Instance() {
        return this.instance || (this.instance = new this());
    }
}
exports.UpdateVideosScheduler = UpdateVideosScheduler;
