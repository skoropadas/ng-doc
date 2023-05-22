import {logging} from '@angular-devkit/core';
import {NgDocPageIndex} from '@ng-doc/core';
import {Observable, of, Subject} from 'rxjs';
import {catchError, switchMap, take} from 'rxjs/operators';

import {ObservableSet} from '../../../classes';
import {NgDocBuilderContext, NgDocBuiltOutput} from '../../../interfaces';
import {NgDocBuilder} from '../../builder';

/**
 * Base entity class that all entities should extend.
 */
export abstract class NgDocEntity {
	/** Indicates when entity was destroyed */
	destroyed: boolean = false;

	/** Search indexes for the current entity */
	indexes: NgDocPageIndex[] = [];

	/**
	 * List of keywords that are used by the entity
	 * (they will be sat by Keywords Processor, and used to indicate when this entity should be re-build if one of them appears)
	 */
	usedKeywords: Set<string> = new Set<string>();

	/**
	 * Collection of all file dependencies of the current entity.
	 * This property is using to watch for changes in this dependencies list and rebuild current buildable.
	 */
	readonly dependencies: ObservableSet<string> = new ObservableSet<string>();

	/**
	 * Indicates if this entity has physical file in file system
	 * If this entity was generated by another Entity, this property should be `false`
	 *
	 * NgDoc destroys all child elements of non-physical entities when they are destroyed
	 */
	readonly physical: boolean = true;

	private destroy$: Subject<void> = new Subject<void>();

	/** Indicates when current entity could be built */
	protected readyToBuild: boolean = false;

	/**
	 * The key by which the entity will be stored in the store
	 */
	abstract readonly id: string;

	/**
	 * Files that are watched for changes to rebuild entity or remove it
	 */
	abstract readonly rootFiles: string[];

	/**
	 * Indicates when it's root entity and should be used for rooted components.
	 */
	abstract readonly isRoot: boolean;

	/**
	 * Should return the parent of the current entity
	 */
	abstract readonly parent?: NgDocEntity;

	/**
	 * Should return the list of the dependencies that have to be built if current entity was changed.
	 */
	abstract readonly buildCandidates: NgDocEntity[];

	constructor(readonly builder: NgDocBuilder, readonly context: NgDocBuilderContext) {}

	/** Indicates if the current entity can be built */
	get canBeBuilt(): boolean {
		return true;
	}

	/**
	 * Recursively returns parents for the current entity
	 *
	 * @type {Array<NgDocEntity>}
	 */
	get parentEntities(): NgDocEntity[] {
		return [this.parent ?? [], this.parent?.parentEntities ?? []].flat();
	}

	/**
	 * The children of the entity.
	 * Contains all children of the current entity.
	 */
	get children(): NgDocEntity[] {
		return this.builder.entities.asArray().filter((entity: NgDocEntity) => entity.parent === this && !entity.destroyed);
	}

	/**
	 * Returns children that are ready to build or already built
	 */
	get builtChildren(): NgDocEntity[] {
		return this.children.filter((entity: NgDocEntity) => entity.isReadyForBuild);
	}

	/**
	 * Recursively returns children for the current entity
	 *
	 * @type {Array<NgDocEntity>}
	 */
	get childEntities(): NgDocEntity[] {
		return [...this.children, ...this.children.map((child: NgDocEntity) => child.childEntities).flat()];
	}

	/**
	 * Returns `true` if current entity has children
	 *
	 * @type {boolean}
	 */
	get hasChildren(): boolean {
		return this.children.length > 0;
	}

	/**
	 * Should return if this entity is ready to build
	 * Using for build process to skip entityStore that is not ready for build
	 *
	 * @type {boolean}
	 */
	get isReadyForBuild(): boolean {
		return this.readyToBuild && !this.destroyed && this.canBeBuilt;
	}

	get logger(): logging.LoggerApi {
		return this.context.context.logger;
	}

	/**
	 * Returns the list of paths that can be cached for the current entity
	 */
	get cachedPaths(): string[] {
		return this.rootFiles.concat(this.dependencies.asArray());
	}

	/**
	 * Build all artifacts that need for application.
	 * This is the last method in the build process, should return output that should be emitted to the file system
	 */
	protected abstract build(): Observable<NgDocBuiltOutput[]>;

	/**
	 * Runs when the source file was updated, can be used to refresh target file etc.
	 */
	abstract update(): Observable<void>;

	/**
	 * Method called by NgDocBuilder when one or more dependencies have changed
	 */
	dependenciesChanged(): void {
		this.readyToBuild = true;
	}

	childrenGenerator(): Observable<NgDocEntity[]> {
		return of([]);
	}

	buildArtifacts(): Observable<NgDocBuiltOutput[]> {
		// Clear all indexes and used keywords before build
		this.usedKeywords.clear();
		this.indexes = [];

		return this.cachedPaths.length && isCacheValid(this.id, this.cachedPaths)
			? of([])
			: this.build().pipe(
					tap(() => updateCache(this.id, this.cachedPaths)),
					catchError((e: Error) => {
						this.logger.error(`Error during processing "${this.id}"\n${e.message}\n${e.stack}`);
						this.readyToBuild = false;

						return of([]);
					}),
			  );
	}

	emit(): Observable<void> {
		// No implementation
		return of(void 0);
	}

	removeArtifacts(): void {
		// No implementation
	}

	/**
	 * Destroys current entity and clear all references
	 *
	 * @type {void}
	 */
	destroy(): void {
		this.children.forEach((entity: NgDocEntity) => !entity.physical && entity.destroy());

		this.readyToBuild = false;
		this.destroyed = true;
		this.destroy$.next();
	}

	onDestroy(): Observable<void> {
		return this.destroy$.asObservable().pipe(take(1));
	}
}
