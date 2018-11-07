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
require("multer");
const send_1 = require("./activitypub/send");
const initializers_1 = require("../initializers");
const activitypub_1 = require("./activitypub");
const image_utils_1 = require("../helpers/image-utils");
const path_1 = require("path");
const database_utils_1 = require("../helpers/database-utils");
const uuidv4 = require("uuid/v4");
function updateActorAvatarFile(avatarPhysicalFile, accountOrChannel) {
    return __awaiter(this, void 0, void 0, function* () {
        const extension = path_1.extname(avatarPhysicalFile.filename);
        const avatarName = uuidv4() + extension;
        const destination = path_1.join(initializers_1.CONFIG.STORAGE.AVATARS_DIR, avatarName);
        yield image_utils_1.processImage(avatarPhysicalFile, destination, initializers_1.AVATARS_SIZE);
        return database_utils_1.retryTransactionWrapper(() => {
            return initializers_1.sequelizeTypescript.transaction((t) => __awaiter(this, void 0, void 0, function* () {
                const updatedActor = yield activitypub_1.updateActorAvatarInstance(accountOrChannel.Actor, avatarName, t);
                yield updatedActor.save({ transaction: t });
                yield send_1.sendUpdateActor(accountOrChannel, t);
                return updatedActor.Avatar;
            }));
        });
    });
}
exports.updateActorAvatarFile = updateActorAvatarFile;
