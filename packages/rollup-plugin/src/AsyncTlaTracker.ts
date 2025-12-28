import { withResolvers } from "./polyfills/promise.js";

class AwaitableCache<K, T> {
	#store = new Map<
		K,
		[
			Promise<T>,
			resolve: (value: T | PromiseLike<T>) => void,
			reject: (reason?: unknown) => void,
		]
	>();

	#getPromise(key: K) {
		const entry = this.#store.get(key);
		if (entry) return entry;
		const { promise, resolve, reject } = withResolvers<T>();
		this.#store.set(key, [promise, resolve, reject]);
		return [promise, resolve, reject] as const;
	}
	resolve(key: K, value: T | PromiseLike<T>) {
		const [_, resolve] = this.#getPromise(key);
		resolve(value);
	}
	reject(key: K) {
		const [_, __, reject] = this.#getPromise(key);
		reject();
	}
	get(key: K) {
		const [promise] = this.#getPromise(key);
		return promise;
	}
}

/**
 * AsyncTlaTracker tracks whether modules must be treated as async due to
 * containing top-level await or being an ancestor of an async module.
 */
export class AsyncTlaTracker<K> {
	#entryCache = new AwaitableCache<K, undefined>();
	#subtreeCache = new AwaitableCache<K, undefined>();
	#resultCache = new Map<K, Promise<Boolean>>();

	// we handle cycles in the most simple (and unoptimized) way possible here
	// to keep the acyclic case optimized
	#seen = new Set<K>();
	#resolved = new Set<K>();
	#childrenSeen = new Set<K>();
	#cycleResolver!: Promise<Boolean>;
	#resolveCycles!: () => void;

	public constructor() {
		this.#createCycleResolver();
	}

	#createCycleResolver() {
		const { promise, resolve } = withResolvers<Boolean>();
		this.#cycleResolver = promise;
		this.#resolveCycles = () => resolve(false);
	}
	#checkForCycles() {
		if (
			this.#childrenSeen.size === this.#seen.size &&
			this.#resolved.size === this.#seen.size
		) {
			// use timeout because resolved promises may still propagate
			const resolveCycles = this.#resolveCycles;
			this.#createCycleResolver();
			setTimeout(() => {
				resolveCycles();
			});
		}
	}

	#bindResultCache(key: K) {
		if (!this.#resultCache.has(key)) {
			this.#resultCache.set(
				key,
				this.#subtreeCache
					.get(key)
					.then(() => false)
					.catch(() => true),
			);
		}
	}
	get(key: K) {
		this.#bindResultCache(key);
		return this.#resultCache.get(key)!;
	}
	setMarked(key: K, value: boolean) {
		this.#seen.add(key);
		this.#resolved.add(key);

		if (value) {
			this.#entryCache.reject(key);
			// handle rejections
			this.#entryCache.get(key).catch(() => {});
		} else {
			this.#entryCache.resolve(key, undefined);
		}

		this.#checkForCycles();
	}
	setChildren(key: K, children: K[]) {
		this.#seen.add(key);
		this.#childrenSeen.add(key);
		children.forEach((child) => {
			this.#seen.add(child);
		});

		Promise.race([
			this.#cycleResolver,
			Promise.all([
				this.#entryCache.get(key),
				...children.map((child) => this.#subtreeCache.get(child)),
			]),
		])
			.then(() => this.#subtreeCache.resolve(key, undefined))
			.catch(() => this.#subtreeCache.reject(key));

		// bind promise to handle rejections
		this.#bindResultCache(key);

		this.#checkForCycles();
	}
}
