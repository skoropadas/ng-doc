import * as fs from 'fs';
import * as path from 'path';

import {getCacheFilePath} from './get-cache-file-path';
import {NgDocCache} from './interfaces';

/**
 * Updates cache for given files
 * This function creates object and writes it to cache file
 *
 * @param id - unique id for cache
 * @param cache - cache object
 */
export function updateCache(id: string, cache: NgDocCache): void {
	const cacheFilePath: string = getCacheFilePath(id);
	const cacheDirPath: string = path.dirname(cacheFilePath);

	if (!fs.existsSync(cacheDirPath)) {
		fs.mkdirSync(cacheDirPath, {recursive: true});
	}

	fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2));
}
