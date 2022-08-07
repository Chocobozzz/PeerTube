


class IdbAssetsStorage {
    constructor(db) {
        this.db = db;
    }

    storeAsset(asset) {
        return new Promise((resolve, reject) => {
            const request = this.db
                .transaction(["assets"], "readwrite")
                .objectStore("assets")
                .put(asset.requestRange === undefined ? { ...asset, requestRange: "" } : asset);
            request.onerror = (event) => reject(event);
            request.onsuccess = (event) => resolve();
        });
    }

    getAsset(requestUri, requestRange, masterSwarmId) {
        return new Promise((resolve, reject) => {
            const request = this.db
                .transaction(["assets"])
                .objectStore("assets")
                .get([requestUri, requestRange === undefined ? "" : requestRange, masterSwarmId]);
            request.onerror = (event) => reject(event);
            request.onsuccess = (event) => resolve(event.target.result);
        });
    }

    destroy() { }
}

class IdbSegmentsStorage {
    constructor(db) {
        this.db = db;
    }

    storeSegment(segment) {
        return new Promise((resolve, reject) => {
            const segmentWithoutData = { ...segment };
            delete segmentWithoutData.data;

            const transaction = this.db.transaction(["segments", "segmentsData"], "readwrite");
            transaction.objectStore("segments").put(segmentWithoutData).onsuccess = () => {
                transaction.objectStore("segmentsData").put({
                    id: segment.id,
                    masterSwarmId: segment.masterSwarmId,
                    data: segment.data,
                });
            };

            transaction.onerror = (event) => reject(event);
            transaction.oncomplete = () => resolve();
        });
    }

    getSegmentsMap(masterSwarmId) {
        return new Promise((resolve, reject) => {
            const cursor = this.db
                .transaction(["segments"])
                .objectStore("segments")
                .index("masterSwarmId")
                .openCursor(IDBKeyRange.only(masterSwarmId));
            const result = new Map();

            cursor.onerror = (event) => reject(event);
            cursor.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    result.set(cursor.value.id, { segment: cursor.value });
                    cursor.continue();
                } else {
                    resolve(result);
                }
            };
        });
    }

    getSegment(id, masterSwarmId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["segments", "segmentsData"]);

            let segment;
            transaction.objectStore("segments").get([id, masterSwarmId]).onsuccess = (event) => {
                segment = event.target.result;
                if (segment === undefined) {
                    return;
                }

                transaction.objectStore("segmentsData").get([id, masterSwarmId]).onsuccess = (event) => {
                    segment.data = event.target.result.data;
                };
            };

            transaction.onerror = (event) => reject(event);
            transaction.oncomplete = () => resolve(segment);
        });
    }

    clean() { }
    destroy() { }
}

export {
    IdbAssetsStorage,
    IdbSegmentsStorage
}