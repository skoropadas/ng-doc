import { NgDocPageType, uid } from '@ng-doc/core';
import { finalize } from 'rxjs';

import { editFileInRepoUrl, viewFileInRepoUrl } from '../../../helpers';
import { buildIndexes } from '../../../helpers/build-indexes';
import { NgDocBuilderContext } from '../../../interfaces';
import { AsyncFileOutput, Builder, IndexStore } from '../../core';
import { renderTemplate } from '../../nunjucks';
import { EntryMetadata, PageEntry } from '../interfaces';
import { replaceKeywords } from './index';

interface Config {
  context: NgDocBuilderContext;
  metadata: EntryMetadata<PageEntry>;
  pageType: NgDocPageType;
  entryHasImports?: boolean;
  entryPath?: string;
  demoAssetsPath?: string;
  playgroundsPath?: string;
  lineNumber?: number;
}

type PostProcess = (html: string) => AsyncFileOutput;

/**
 *
 * @param builder
 * @param config
 */
export function pageComponentBuilder<T>(
  builder: (postProcess: PostProcess) => Builder<T>,
  config: Config,
): Builder<T> {
  const {
    context,
    metadata,
    pageType,
    entryPath,
    entryHasImports,
    demoAssetsPath,
    playgroundsPath,
    lineNumber,
  } = config;
  let removeIndexes: () => void = () => {};

  return builder((html: string) => {
    removeIndexes();

    // Replace keywords in the template at the end of the build process
    return async () => {
      const content = await replaceKeywords(html);
      const editSourceFileUrl =
        context.config.repoConfig &&
        editFileInRepoUrl(context.config.repoConfig, metadata.path, metadata.route, lineNumber);
      const viewSourceFileUrl =
        context.config.repoConfig &&
        viewFileInRepoUrl(context.config.repoConfig, metadata.path, lineNumber);
      const indexes = await buildIndexes({
        content,
        title: metadata.title,
        breadcrumbs: metadata.breadcrumbs(),
        pageType,
        route: metadata.absoluteRoute(),
      });

      removeIndexes = IndexStore.add(...indexes);

      return {
        filePath: metadata.outPath,
        content: renderTemplate('./page.ts.nunj', {
          context: {
            id: uid(),
            content,
            metadata,
            editSourceFileUrl,
            viewSourceFileUrl,
            pageType,
            entryPath,
            entryHasImports,
            demoAssetsPath,
            playgroundsPath,
          },
        }),
      };
    };
  }).pipe(finalize(() => removeIndexes));
}
