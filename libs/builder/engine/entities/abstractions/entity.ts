import {logging} from '@angular-devkit/core';
import {NgDocPageIndex} from '@ng-doc/core';
import {forkJoin, from, Observable, of, Subject} from 'rxjs';
import {catchError, map, mapTo, switchMap, take, tap} from 'rxjs/operators';

import {ObservableSet} from '../../../classes';
import {codeTypeFromExt, getPageType, importEsModule, isCacheValid, isRouteEntity, updateCache} from '../../../helpers';
import {buildIndexes} from '../../../helpers/build-indexes';
import {NgDocBuilderContext, NgDocBuiltOutput} from '../../../interfaces';
import {NgDocBuilder} from '../../builder';

/**
 * Base entity class that all entities should extend.
 */
export abstract class NgDocEntity {
	/** Last built artifacts */
	artifacts: NgDocBuiltOutput[] = [];

	/** Indicates when entity was destroyed */
	destroyed: boolean = false;

	/** Search indexes for the current entity */
	indexes: NgDocPageIndex[] = [];

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
		return this.cachedPaths.length && isCacheValid(this.id, this.cachedPaths)
			? of([])
			: this.build().pipe(
					switchMap((output: NgDocBuiltOutput[]) => this.processArtifacts(output)),
					map((artifacts: NgDocBuiltOutput[]) => {
						/*
							We are checking that artifacts result was changed, otherwise we don't want to emit
							the same files to file system, because it will force Angular to rebuild application
						 */
						if (artifacts.every((a: NgDocBuiltOutput, i: number) => a.content === this.artifacts[i]?.content)) {
							return [];
						}

						this.artifacts = artifacts;

						updateCache(this.id, this.cachedPaths);

						return this.artifacts;
					}),
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

	private processArtifacts(artifacts: NgDocBuiltOutput[]): Observable<NgDocBuiltOutput[]> {
		this.indexes = [];

		if (!artifacts.length) {
			return of([]);
		}

		return forkJoin(
			artifacts.map((artifact: NgDocBuiltOutput) => {
				if (codeTypeFromExt(artifact.filePath) === 'HTML') {
					// eslint-disable-next-line @typescript-eslint/ban-ts-comment
					// @ts-ignore
					return from(importEsModule<typeof import('@ng-doc/utils')>('@ng-doc/utils')).pipe(
						switchMap((utils: typeof import('@ng-doc/utils')) => {
							if (isRouteEntity(this)) {
								this.usedKeywords = new Set();
							}

							return utils.htmlPostProcessor(artifact.content, {
								headings: this.context.config.guide?.anchorHeadings,
								route: isRouteEntity(this) ? this.fullRoute : undefined,
								addUsedKeyword: isRouteEntity(this) ? this.usedKeywords.add.bind(this.usedKeywords) : undefined,
								getKeyword: this.builder.entities.getByKeyword.bind(this.builder.entities),
							});
						}),
						map((content: string) => ({...artifact, content})),
					);
				}

				return of(artifact);
			}),
		).pipe(
			switchMap((artifacts: NgDocBuiltOutput[]) => {
				const htmlArtifacts = artifacts.filter(
					(artifact: NgDocBuiltOutput) => codeTypeFromExt(artifact.filePath) === 'HTML',
				);

				return htmlArtifacts.length === 0
					? of(artifacts)
					: forkJoin(
							htmlArtifacts.map((artifact: NgDocBuiltOutput) =>
								isRouteEntity(this)
									? buildIndexes({
											title: this.title,
											content: artifact.content,
											pageType: getPageType(this),
											breadcrumbs: this.breadcrumbs,
											route: isRouteEntity(this) ? this.fullRoute : '',
									  })
									: of([]),
							),
					  ).pipe(
							tap((indexes: NgDocPageIndex[][]) => (this.indexes = indexes.flat())),
							mapTo(artifacts),
					  );
			}),
		);
	}
}
