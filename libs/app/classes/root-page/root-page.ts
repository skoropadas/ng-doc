import {NgDocDemoAssets} from '@ng-doc/app/interfaces';
import {NgDocDependencies} from '@ng-doc/core';

/**
 * Base class for NgDoc page
 */
export abstract class NgDocRootPage {
	/**
	 * Html content of the page
	 */
	abstract readonly pageContent: string;

	/**
	 * Edit URL that can be used to edit the page source file in the repository
	 */
	abstract readonly editSourceFileUrl?: string;

	/**
	 * View URL that can be used to view the page source file in the repository
	 */
	abstract readonly viewSourceFileUrl?: string;

	/**
	 * The page dependencies file
	 */
	abstract readonly dependencies?: NgDocDependencies;

	/**
	 * The page demo assets that have code examples of the demo components
	 */
	abstract readonly demoAssets?: NgDocDemoAssets;
}
