import type { Container } from "../contracts/Container";
import type { FactoryFunction } from "./ContainerImpl";
import type { KeyOrClass } from "./container-key";

type AddCallback = (need: KeyOrClass, factory: FactoryFunction<unknown>) => void;

export class ContextualBindingBuilder {
  constructor(
    private container: Container,
    private add: AddCallback,
  ) {}

  needs<T>(need: KeyOrClass<T>): ContextualBindingBuilderFinal<T> {
    return new ContextualBindingBuilderFinal(this.container, this.add, need);
  }
}

class ContextualBindingBuilderFinal<T> {
  constructor(
    private container: Container,
    private add: AddCallback,
    private need: KeyOrClass,
  ) {}

  give(key: KeyOrClass<T>): void {
    this.add(this.need, (() => this.container.get(key)) as FactoryFunction<unknown>);
  }

  create(factory: FactoryFunction<T>): void {
    this.add(this.need, factory as FactoryFunction<unknown>);
  }
}
