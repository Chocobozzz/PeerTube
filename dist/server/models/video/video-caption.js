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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
var VideoCaptionModel_1;
const sequelize_typescript_1 = require("sequelize-typescript");
const utils_1 = require("../utils");
const video_1 = require("./video");
const video_captions_1 = require("../../helpers/custom-validators/video-captions");
const initializers_1 = require("../../initializers");
const path_1 = require("path");
const logger_1 = require("../../helpers/logger");
const fs_extra_1 = require("fs-extra");
var ScopeNames;
(function (ScopeNames) {
    ScopeNames["WITH_VIDEO_UUID_AND_REMOTE"] = "WITH_VIDEO_UUID_AND_REMOTE";
})(ScopeNames = exports.ScopeNames || (exports.ScopeNames = {}));
let VideoCaptionModel = VideoCaptionModel_1 = class VideoCaptionModel extends sequelize_typescript_1.Model {
    static removeFiles(instance) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!instance.Video) {
                instance.Video = (yield instance.$get('Video'));
            }
            if (instance.isOwned()) {
                logger_1.logger.info('Removing captions %s of video %s.', instance.Video.uuid, instance.language);
                try {
                    yield instance.removeCaptionFile();
                }
                catch (err) {
                    logger_1.logger.error('Cannot remove caption file of video %s.', instance.Video.uuid);
                }
            }
            return undefined;
        });
    }
    static loadByVideoIdAndLanguage(videoId, language) {
        const videoInclude = {
            model: video_1.VideoModel.unscoped(),
            attributes: ['id', 'remote', 'uuid'],
            where: {}
        };
        if (typeof videoId === 'string')
            videoInclude.where['uuid'] = videoId;
        else
            videoInclude.where['id'] = videoId;
        const query = {
            where: {
                language
            },
            include: [
                videoInclude
            ]
        };
        return VideoCaptionModel_1.findOne(query);
    }
    static insertOrReplaceLanguage(videoId, language, transaction) {
        const values = {
            videoId,
            language
        };
        return VideoCaptionModel_1.upsert(values, { transaction, returning: true })
            .then(([caption]) => caption);
    }
    static listVideoCaptions(videoId) {
        const query = {
            order: [['language', 'ASC']],
            where: {
                videoId
            }
        };
        return VideoCaptionModel_1.scope(ScopeNames.WITH_VIDEO_UUID_AND_REMOTE).findAll(query);
    }
    static getLanguageLabel(language) {
        return initializers_1.VIDEO_LANGUAGES[language] || 'Unknown';
    }
    static deleteAllCaptionsOfRemoteVideo(videoId, transaction) {
        const query = {
            where: {
                videoId
            },
            transaction
        };
        return VideoCaptionModel_1.destroy(query);
    }
    isOwned() {
        return this.Video.remote === false;
    }
    toFormattedJSON() {
        return {
            language: {
                id: this.language,
                label: VideoCaptionModel_1.getLanguageLabel(this.language)
            },
            captionPath: this.getCaptionStaticPath()
        };
    }
    getCaptionStaticPath() {
        return path_1.join(initializers_1.STATIC_PATHS.VIDEO_CAPTIONS, this.getCaptionName());
    }
    getCaptionName() {
        return `${this.Video.uuid}-${this.language}.vtt`;
    }
    removeCaptionFile() {
        return fs_extra_1.remove(initializers_1.CONFIG.STORAGE.CAPTIONS_DIR + this.getCaptionName());
    }
};
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], VideoCaptionModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], VideoCaptionModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('VideoCaptionLanguage', value => utils_1.throwIfNotValid(value, video_captions_1.isVideoCaptionLanguageValid, 'language')),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], VideoCaptionModel.prototype, "language", void 0);
__decorate([
    sequelize_typescript_1.ForeignKey(() => video_1.VideoModel),
    sequelize_typescript_1.Column,
    __metadata("design:type", Number)
], VideoCaptionModel.prototype, "videoId", void 0);
__decorate([
    sequelize_typescript_1.BelongsTo(() => video_1.VideoModel, {
        foreignKey: {
            allowNull: false
        },
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", video_1.VideoModel)
], VideoCaptionModel.prototype, "Video", void 0);
__decorate([
    sequelize_typescript_1.BeforeDestroy,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [VideoCaptionModel]),
    __metadata("design:returntype", Promise)
], VideoCaptionModel, "removeFiles", null);
VideoCaptionModel = VideoCaptionModel_1 = __decorate([
    sequelize_typescript_1.Scopes({
        [ScopeNames.WITH_VIDEO_UUID_AND_REMOTE]: {
            include: [
                {
                    attributes: ['uuid', 'remote'],
                    model: () => video_1.VideoModel.unscoped(),
                    required: true
                }
            ]
        }
    }),
    sequelize_typescript_1.Table({
        tableName: 'videoCaption',
        indexes: [
            {
                fields: ['videoId']
            },
            {
                fields: ['videoId', 'language'],
                unique: true
            }
        ]
    })
], VideoCaptionModel);
exports.VideoCaptionModel = VideoCaptionModel;
