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
var TagModel_1;
const Sequelize = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const videos_1 = require("../../helpers/custom-validators/videos");
const utils_1 = require("../utils");
const video_1 = require("./video");
const video_tag_1 = require("./video-tag");
const videos_2 = require("../../../shared/models/videos");
let TagModel = TagModel_1 = class TagModel extends sequelize_typescript_1.Model {
    static findOrCreateTags(tags, transaction) {
        if (tags === null)
            return [];
        const tasks = [];
        tags.forEach(tag => {
            const query = {
                where: {
                    name: tag
                },
                defaults: {
                    name: tag
                },
                transaction
            };
            const promise = TagModel_1.findOrCreate(query)
                .then(([tagInstance]) => tagInstance);
            tasks.push(promise);
        });
        return Promise.all(tasks);
    }
    static getRandomSamples(threshold, count) {
        const query = 'SELECT tag.name FROM tag ' +
            'INNER JOIN "videoTag" ON "videoTag"."tagId" = tag.id ' +
            'INNER JOIN video ON video.id = "videoTag"."videoId" ' +
            'WHERE video.privacy = $videoPrivacy AND video.state = $videoState ' +
            'GROUP BY tag.name HAVING COUNT(tag.name) >= $threshold ' +
            'ORDER BY random() ' +
            'LIMIT $count';
        const options = {
            bind: { threshold, count, videoPrivacy: videos_2.VideoPrivacy.PUBLIC, videoState: videos_2.VideoState.PUBLISHED },
            type: Sequelize.QueryTypes.SELECT
        };
        return TagModel_1.sequelize.query(query, options)
            .then(data => data.map(d => d.name));
    }
};
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Is('VideoTag', value => utils_1.throwIfNotValid(value, videos_1.isVideoTagValid, 'tag')),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], TagModel.prototype, "name", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], TagModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], TagModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.BelongsToMany(() => video_1.VideoModel, {
        foreignKey: 'tagId',
        through: () => video_tag_1.VideoTagModel,
        onDelete: 'CASCADE'
    }),
    __metadata("design:type", Array)
], TagModel.prototype, "Videos", void 0);
TagModel = TagModel_1 = __decorate([
    sequelize_typescript_1.Table({
        tableName: 'tag',
        timestamps: false,
        indexes: [
            {
                fields: ['name'],
                unique: true
            }
        ]
    })
], TagModel);
exports.TagModel = TagModel;
//# sourceMappingURL=tag.js.map