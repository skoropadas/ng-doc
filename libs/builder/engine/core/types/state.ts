/**
 * Represents a pending state in the builder process.
 * This class is used when the builder is still in progress and the result is not yet available.
 */
export class BuilderPending {
	readonly state: 'pending' = 'pending' as const;
}

/**
 * Represents a done state in the builder process.
 * This class is used when the builder has finished and the result is available.
 * @template T The type of the result.
 */
export class BuilderDone<T> {
	readonly state: 'done' = 'done' as const;

	/**
	 * Creates a new instance of the BuilderDone class.
	 * @param {T} result The result of the builder process.
	 */
	constructor(readonly result: T) {}
}

/**
 * Represents an error state in the builder process.
 * This class is used when the builder has encountered an error.
 */
export class BuilderError {
	readonly state: 'error' = 'error' as const;

	/**
	 * Creates a new instance of the BuilderError class.
	 * @param {Error[]} error The errors encountered during the builder process.
	 */
	constructor(readonly error: Error[]) {}
}
/**
 * Represents the state of a builder. It can be one of the following:
 * - BuilderPending: The builder is still in progress and the result is not yet available.
 * - BuilderDone: The builder has finished and the result is available.
 * - BuilderError: The builder has encountered an error.
 * @template T The type of the result when the builder is done.
 */
export type BuilderState<T = never> = BuilderPending | BuilderDone<T> | BuilderError;

/**
 * Type guard function to check if a given state is a BuilderPending state.
 * @param {BuilderState<T>} state - The state to check.
 * @returns {boolean} - Returns true if the state is a BuilderPending state, false otherwise.
 */
export function isBuilderPending<T>(state: BuilderState<T>): state is BuilderPending {
	return state instanceof BuilderPending;
}

/**
 * Type guard function to check if a given state is a BuilderDone state.
 * @param {BuilderState<T>} state - The state to check.
 * @returns {boolean} - Returns true if the state is a BuilderDone state, false otherwise.
 */
export function isBuilderDone<T>(state: BuilderState<T>): state is BuilderDone<T> {
	return state instanceof BuilderDone;
}

/**
 * Type guard function to check if a given state is a BuilderError state.
 * @param {BuilderState<T>} state - The state to check.
 * @returns {boolean} - Returns true if the state is a BuilderError state, false otherwise.
 */
export function isBuilderError<T>(state: BuilderState<T>): state is BuilderError {
	return state instanceof BuilderError;
}
