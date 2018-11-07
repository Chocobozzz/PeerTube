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
const path_1 = require("path");
const sequelize_typescript_1 = require("sequelize-typescript");
const initializers_1 = require("../../initializers");
const logger_1 = require("../../helpers/logger");
const fs_extra_1 = require("fs-extra");
let AvatarModel = class AvatarModel extends sequelize_typescript_1.Model {
    static removeFilesAndSendDelete(instance) {
        logger_1.logger.info('Removing avatar file %s.', instance.filename);
        instance.removeAvatar()
            .catch(err => logger_1.logger.error('Cannot remove avatar file %s.', instance.filename, err));
    }
    toFormattedJSON() {
        return {
            path: this.getWebserverPath(),
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }
    getWebserverPath() {
        return path_1.join(initializers_1.STATIC_PATHS.AVATARS, this.filename);
    }
    removeAvatar() {
        const avatarPath = path_1.join(initializers_1.CONFIG.STORAGE.AVATARS_DIR, this.filename);
        return fs_extra_1.remove(avatarPath);
    }
};
__decorate([
    sequelize_typescript_1.AllowNull(false),
    sequelize_typescript_1.Column,
    __metadata("design:type", String)
], AvatarModel.prototype, "filename", void 0);
__decorate([
    sequelize_typescript_1.CreatedAt,
    __metadata("design:type", Date)
], AvatarModel.prototype, "createdAt", void 0);
__decorate([
    sequelize_typescript_1.UpdatedAt,
    __metadata("design:type", Date)
], AvatarModel.prototype, "updatedAt", void 0);
__decorate([
    sequelize_typescript_1.AfterDestroy,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AvatarModel]),
    __metadata("design:returntype", void 0)
], AvatarModel, "removeFilesAndSendDelete", null);
AvatarModel = __decorate([
    sequelize_typescript_1.Table({
        tableName: 'avatar'
    })
], AvatarModel);
exports.AvatarModel = AvatarModel;
//# sourceMappingURL=avatar.js.map