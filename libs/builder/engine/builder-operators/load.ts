import {Observable, of, OperatorFunction} from 'rxjs';
import {map, switchMap} from 'rxjs/operators';

import {isFileEntity} from '../../helpers';
import {NgDocEntity} from '../entities/abstractions/entity';

/**
 * Operator that runs the `update` method of the entity.
 */
export function load(): OperatorFunction<NgDocEntity, NgDocEntity> {
	return (source: Observable<NgDocEntity>) =>
		source.pipe(
			switchMap((e: NgDocEntity) => {
				if (isFileEntity(e)) {
					return e.load().pipe(map(() => e));
				}

				return of(e);
			}),
		);
}
