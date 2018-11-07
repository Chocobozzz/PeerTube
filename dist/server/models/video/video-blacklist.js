"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
var VideoBlacklistModel_1;
const sequelize_typescript_1 = require("sequelize-typescript");
const utils_1 = require("../utils");
const video_1 = require("./video");
const video_blacklist_1 = require("../../helpers/custom-validators/video-blacklist");
const emailer_1 = require("../../lib/emailer");
const initializers_1 = require("../../initializers");
let VideoBlacklistModel = VideoBlacklistModel_1 = class VideoBlacklistModel extends sequelize_typescript_1.Model {
    static sendBlacklistEmailNotification(instance) {
        return emailer_1.Emailer.Instance.addVideoBlacklistReportJob(instance.videoId, instance.reason);
    }
    static sendUnblacklistEmailNotification(instance) {
        return emailer_1.Emailer.Instance.addVideoUnblacklistReportJob(instance.videoId);
    }
    static listForApi(start, count, sort) {
        const query = {
            offset: start,
            limit: count,
            order: utils_1.getSortOnModel(sort.sortModel, sort.sortValue),
            include: [
                {
                    model: video_1.VideoModel,
                    required: true
                }
            ]
        };
        return VideoBlacklistModel_1.findAndCountAll(query)
            .then(({ rows, count }) => {
            return {
                data: rows,
                total: count
            };
        });
    }
    static loadByVideoId(id) {
        const query = {
            where: {
                videoId: id
            }
        };
        return VideoBlacklistModel_1.findOne(query);
    }
    toFormattedJSON() {
        const video = this.Video;
        return {
            id: this.id,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            reason: this.reason,
            video: {
                id: video.id,
                name: video.name,
                uuid: video.uuid,
                description: video.description,
                duration: video.duration,
                views: video.views,
                likes: video.likes,
                dislikes: video.dislikes,
                nsfw: video.nsfw
            }
        };
    }
};
__decorate([
    sequelize_typescript_1.AllowNull(true),
    sequelize_typescript_1.Is('VideoBlacklistReason', value => utils_1.throwIfNotValid(value, video_blacklist_1.isVideoBlacklistReasonValid, 'reason')),
    sequelize_typescript_1.Column(sequelize_typescript_1.DataType.STRING(initializers_1.CONSTRAINTS_FIELDS.VIDEO_BLACKLIST.REASON.max)),
    __metadata("design:type", String)
], VideoBlacklistModel.prototype, "reason", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], VideoBlacklistModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], VideoBlacklistModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => video_1.VideoModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoBlacklistModel.prototype, "videoId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => video_1.VideoModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'cascade'
    }),
    __metadata("design:type", video_1.VideoModel)
], VideoBlacklistModel.prototype, "Video", void 0);
__decorate([
    sequelize_typescript_1.AfterCreate,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [VideoBlacklistModel]),
    __metadata("design:returntype", void 0)
], VideoBlacklistModel, "sendBlacklistEmailNotification", null);
__decorate([
    sequelize_typescript_1.AfterDestroy,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [VideoBlacklistModel]),
    __metadata("design:returntype", void 0)
], VideoBlacklistModel, "sendUnblacklistEmailNotification", null);
VideoBlacklistModel = VideoBlacklistModel_1 = __decorate([
    sequelize_typescript_1.Table({
        tableName: 'videoBlacklist',
        indexes: [
            {
                fields: ['videoId'],
                unique: true
            }
        ]
    })
], VideoBlacklistModel);
exports.VideoBlacklistModel = VideoBlacklistModel;
