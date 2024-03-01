import { createEntryMetadata, onDependenciesChange, PAGES_STORE } from '@ng-doc/builder';
import { NgDocPage } from '@ng-doc/core';
import { finalize, merge, takeUntil } from 'rxjs';
import { startWith } from 'rxjs/operators';

import { ObservableSet } from '../../../classes';
import { buildFileEntity, importFreshEsm } from '../../../helpers';
import { NgDocBuilderContext } from '../../../interfaces';
import { Builder, runBuild, watchFile } from '../../core';
import { EntryMetadata } from '../interfaces';

interface Config {
  context: NgDocBuilderContext;
  pagePath: string;
}

export const PAGE_FILE_BUILDER_TAG = 'PageFile';

/**
 * A builder function for a page file.
 *
 * This function returns a Builder Observable that emits a NgDocPage object whenever the file at the provided path changes.
 * The Builder Observable is created by merging an Observable that emits on file changes.
 * When the file changes, the build function is called, which compiles the TypeScript file, imports it as an ES module, and returns the default export.
 * @returns {Builder<NgDocPage>} - A Builder Observable that emits a NgDocPage object whenever the file at the provided path changes.
 * @param config - The configuration object for the builder.
 */
export function pageFileBuilder(config: Config): Builder<EntryMetadata<NgDocPage>> {
  const { context, pagePath } = config;
  const sourceFile = context.project.addSourceFileAtPath(pagePath);
  const dependencies = new ObservableSet<string>();

  return merge(watchFile(pagePath, 'update'), onDependenciesChange(dependencies)).pipe(
    startWith(void 0),
    runBuild(PAGE_FILE_BUILDER_TAG, async () => {
      dependencies.clear();

      await sourceFile.refreshFromFileSystem();

      const outPath = await buildFileEntity(
        sourceFile,
        context.tsConfig,
        context.context.workspaceRoot,
      );
      const page = (await importFreshEsm<{ default: NgDocPage }>(outPath)).default;
      const metadata = createEntryMetadata(context, page, sourceFile);

      addCategoriesToDependencies(metadata, dependencies);

      PAGES_STORE.add([pagePath, metadata]);

      return metadata;
    }),
    finalize(() => PAGES_STORE.delete(pagePath)),
    takeUntil(watchFile(pagePath, 'delete')),
  );
}

/**
 *
 * @param metadata
 * @param dependencies
 */
function addCategoriesToDependencies(metadata: EntryMetadata, dependencies: ObservableSet<string>) {
  if (metadata.category) {
    dependencies.add(metadata.category.sourceFile.getFilePath());

    addCategoriesToDependencies(metadata.category, dependencies);
  }
}
