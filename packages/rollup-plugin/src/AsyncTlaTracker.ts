import { withResolvers } from "./polyfills/promise.js";

class AwaitableCache<K, T> {
	#store = new Map<
		K,
		[Promise<T>, resolve: (value: T | PromiseLike<T>) => void]
	>();

	#getPromise(key: K) {
		const entry = this.#store.get(key);
		if (entry) return entry;
		const { promise, resolve } = withResolvers<T>();
		this.#store.set(key, [promise, resolve]);
		return [promise, resolve] as const;
	}
	set(key: K, value: T | PromiseLike<T>) {
		const [_, resolve] = this.#getPromise(key);
		resolve(value);
	}
	get(key: K) {
		const [promise] = this.#getPromise(key);
		return promise;
	}
}

// TODO optimize by allowing setMarked with value false
export class AsyncTlaTracker<K> {
	#all = new Set<K>();
	#unseen = new Set<K>();
	#unresolved = new Set<K>();
	#resultCache = new AwaitableCache<K, Boolean>();

	get(key: K) {
		return this.#resultCache.get(key);
	}
	setMarked(key: K, value: boolean) {
		this.#all.add(key);
		this.#unseen.delete(key);
		this.#unresolved.delete(key);
		this.#resultCache.set(key, true);
		// last action
		setTimeout(() => {
			if (this.#unseen.size == 0) {
				this.#unresolved.forEach((e) => this.#resultCache.set(e, false));
				// TODO workaround
				this.#all.forEach((e) => this.#resultCache.set(e, false));
				this.#unresolved.clear();
			}
		}, 0);
	}
	setChildren(key: K, children: K[]) {
		if (!this.#all.has(key)) {
			this.#all.add(key);
			this.#unresolved.add(key);
		}
		this.#unseen.delete(key);
		children.forEach((children) => {
			if (!this.#all.has(children)) {
				this.#all.add(children);
				this.#unresolved.add(key);
				this.#unseen.add(children);
			}
			this.#resultCache.get(children).then((value) => {
				if (value) {
					this.setMarked(key, true);
				}
			});
		});
		setTimeout(() => {
			if (this.#unseen.size == 0) {
				this.#unresolved.forEach((e) => this.#resultCache.set(e, false));
				// TODO workaround
				this.#all.forEach((e) => this.#resultCache.set(e, false));
				this.#unresolved.clear();
			}
		}, 0);
	}
}
