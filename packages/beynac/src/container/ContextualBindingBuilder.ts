import type { Container, FactoryFunction } from "./container";
import type { KeyOrClass } from "./container-key";

type AddCallback<C extends Container> = (
  need: KeyOrClass,
  factory: FactoryFunction<unknown, C>,
) => void;

export class ContextualBindingBuilder<C extends Container> {
  constructor(
    private container: C,
    private add: AddCallback<C>,
  ) {}

  needs<T>(need: KeyOrClass<T>): ContextualBindingBuilderFinal<T, C> {
    return new ContextualBindingBuilderFinal(this.container, this.add, need);
  }
}

/**
 * Class for building contextual bindings in the container
 */
class ContextualBindingBuilderFinal<T, C extends Container> {
  constructor(
    private container: C,
    private add: AddCallback<C>,
    private need: KeyOrClass,
  ) {}

  /**
   * Define the implementation for the contextual binding.
   *
   * @param key The implementation
   */
  give(key: KeyOrClass<T | undefined>): void {
    type Factory = FactoryFunction<unknown, C>;
    this.add(this.need, (() => this.container.get(key)) as Factory);
  }

  /**
   * Define the implementation for the contextual binding.
   *
   * @param key The implementation
   */
  create(factory: FactoryFunction<T, C>): void {
    this.add(this.need, factory);
  }
}
