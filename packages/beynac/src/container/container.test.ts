import { afterEach, beforeEach, describe, expect, expectTypeOf, mock, test } from "bun:test";
import { createKey } from "../keys";
import { asyncGate } from "../test-utils";
import { Container } from "./container";
import type { KeyOrClass } from "./container-key";
import { inject, injectOptional } from "./inject";

let container: Container;

beforeEach(() => {
  container = new Container();
  Dep.instantiations = 0;
});

afterEach(() => {
  Container.setInstance(null);
});

describe("Container", () => {
  test("container singleton", () => {
    Container.setInstance(container);
    expect(container).toBe(Container.getInstance());
    Container.setInstance(null);
    const container2 = Container.getInstance();
    expect(container2).toBeInstanceOf(Container);
    expect(container2).not.toBe(container);
  });

  test("resolution of bound type token", () => {
    const name = createKey<string>();
    container.bind(name, { factory: () => "Bernie" });
    expect(container.get(name)).toBe("Bernie");
  });

  test("failed resolution of unbound token", () => {
    const string = createKey({ displayName: "Test" });
    expect(() => container.get(string)).toThrowErrorMatchingInlineSnapshot(
      `"Can't create an instance of [Test] because no value or factory function was supplied"`,
    );
  });

  test("resolution of bound class with injected dependencies", () => {
    const nameToken = createKey<string>({ displayName: "name" });
    class HasNameDependency {
      constructor(public name = inject(nameToken)) {}
    }
    container.bind(nameToken, { factory: () => "Bernie" });
    container.bind(HasNameDependency);
    expect(container.get(HasNameDependency).name).toBe("Bernie");
  });

  test("resolution of bound class with factory function and injected dependencies", () => {
    const nameToken = createKey<string>({ displayName: "name" });
    class HasNameDependency {
      constructor(public name = inject(nameToken)) {}
    }
    container.bind(nameToken, { factory: () => "Bernie" });
    container.bind(HasNameDependency, {
      factory: () => new HasNameDependency(),
    });
    expect(container.get(HasNameDependency).name).toBe("Bernie");
  });

  test("resolution of an unbound class value", () => {
    class Foo {}
    const foo1 = container.get(Foo);
    const foo2 = container.get(Foo);
    expect(foo1).toBeInstanceOf(Foo);
    expect(foo2).toBeInstanceOf(Foo);
    expect(foo1).not.toBe(foo2);
  });

  test("error when trying to instantiate a value with unbound dependencies", () => {
    const nameToken = createKey<string>({ displayName: "name" });
    class HasNameDependency {
      constructor(public name = inject(nameToken)) {}
    }
    expect(() => new HasNameDependency()).toThrowErrorMatchingInlineSnapshot(
      `"Dependencies that use inject() must be created by the container. See https://beynac.dev/xyz TODO make online explainer for this error and list causes and symptoms"`,
    );
  });

  test("auto-resolution of class with auto-resolvable dependencies", () => {
    class A {
      constructor(public b = inject(B)) {}
    }
    class B {
      value = "hi";
    }
    expect(container.get(A)).toMatchObject({ b: { value: "hi" } });
  });

  test("error when resolving a value with missing injected dependencies", () => {
    const nameToken = createKey<string>({ displayName: "name" });
    class HasNameDependency {
      constructor(public name = inject(nameToken)) {}
    }
    container.bind(HasNameDependency);
    expect(() => container.get(HasNameDependency)).toThrowErrorMatchingInlineSnapshot(
      `"Can't create an instance of [name] because no value or factory function was supplied (while building [HasNameDependency])"`,
    );
  });

  test("abstract can be bound from concrete type", () => {
    class Foo {}
    container.bind(Foo);
    expect(container.get(Foo)).toBeInstanceOf(Foo);
  });

  test("can create a null-returning factory function", () => {
    const token = createKey<string | null>();
    container.bind(token, { factory: () => null });
    expect(container.bound(token)).toBe(true);
    expect(container.get(token)).toBe(null);
  });

  test("can create a null-returning factory function for a singleton", () => {
    const token = createKey<string | null>();
    const factory = mock(() => null);
    container.bind(token, { factory, lifecycle: "singleton" });
    expect(container.bound(token)).toBe(true);
    expect(container.get(token)).toBe(null);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  test("type and runtime error when attempting to bind a type token", () => {
    const token = createKey();
    expect(() =>
      //@ts-expect-error testing ts error
      container.bind(token),
    ).toThrow("When binding a type token you must supply a function to create an instance");
  });

  test("bound checks if a type token is bound", () => {
    const token = createKey();
    expect(container.bound(token)).toBe(false);
    container.bind(token, { factory: () => false });
    expect(container.bound(token)).toBe(true);
  });

  test("bound checks if a class is bound", () => {
    class Foo {}
    expect(container.bound(Foo)).toBe(false);
    container.bind(Foo);
    expect(container.bound(Foo)).toBe(true);
  });

  test("bindIf doesn't register if service already registered", () => {
    const name = createKey();
    container.bind(name, { factory: () => "Bernie" });
    container.bind(name, { factory: () => "Miguel", ifNotBound: true });

    expect(container.get(name)).toBe("Bernie");
  });

  test("bindIf does register if service not registered yet", () => {
    const surname = createKey();
    const name = createKey();
    container.bind(surname, { factory: () => "Sumption" });
    container.bind(name, { factory: () => "Bernie", ifNotBound: true });

    expect(container.get(name)).toBe("Bernie");
  });

  test("instance registers an instance of a class", () => {
    container.bind(Dep, {
      instance: new Dep("instance"),
      lifecycle: "singleton",
    });
    expect(container.getLifecycle(Dep)).toBe("singleton");
    expect(container.get(Dep).name).toBe("instance");
  });

  test("instance registers an instance for a token", () => {
    const token = createKey<Dep>();
    container.bind(token, {
      instance: new Dep("instance"),
      lifecycle: "singleton",
    });
    expect(container.getLifecycle(token)).toBe("singleton");
    expect(container.get(token).name).toBe("instance");
  });

  test("resolved resolves alias to binding name before checking", () => {
    class Foo {}
    container.bind(Foo);
    const fooAlias = createKey<Foo>();
    container.alias({ from: fooAlias, to: Foo });

    expect(container.resolved(Foo)).toBe(false);
    expect(container.resolved(fooAlias)).toBe(false);

    container.get(Foo);

    expect(container.resolved(Foo)).toBe(true);
    expect(container.resolved(fooAlias)).toBe(true);
  });

  test("resolved considers provided shared instance to be resolved", () => {
    class Foo {}

    expect(container.resolved(Foo)).toBe(false);

    container.bind(Foo, { instance: new Foo(), lifecycle: "singleton" });

    expect(container.resolved(Foo)).toBe(true);
  });

  test("alias to bound type token", () => {
    const from = createKey();
    const to = createKey();
    container.bind(to, { factory: () => "to value" });
    container.alias({ from, to });
    expect(container.get(from)).toBe("to value");
  });

  test("alias to bound class reference", () => {
    class Foo {}
    const foo = new Foo();
    const from = createKey<Foo>();
    container.bind(Foo, { factory: () => foo });
    container.alias({ from, to: Foo });
    expect(container.get(from)).toBe(foo);
  });

  test("alias to unbound type token", () => {
    const from = createKey({ displayName: "from" });
    const to = createKey({ displayName: "to" });
    container.alias({ from, to });
    expect(() => container.get(from)).toThrowErrorMatchingInlineSnapshot(
      `"Can't create an instance of [to] because no value or factory function was supplied"`,
    );
  });

  test("alias to unbound class reference", () => {
    class Foo {}
    const from = createKey<Foo>();
    container.alias({ from, to: Foo });
    const instance = container.get(from);
    expect(instance).toBeInstanceOf(Foo);
    // not a singleton
    expect(container.get(from)).not.toBe(instance);
    expect(container.bound(Foo)).toBe(false);
  });

  test("error message when following circular alias", () => {
    const quux = createKey({ displayName: "quux" });
    const foo = createKey({ displayName: "foo" });
    const bar = createKey({ displayName: "bar" });
    const baz = createKey({ displayName: "baz" });
    container.alias({ from: quux, to: foo });
    container.alias({ from: foo, to: bar });
    container.alias({ from: bar, to: baz });
    container.alias({ from: baz, to: foo });
    expect(() => container.get(quux)).toThrowErrorMatchingInlineSnapshot(
      `"Circular alias detected: [foo] -> [bar] -> [baz] -> [foo]"`,
    );
  });

  test("singleton token resolution", () => {
    const token = createKey<object>();
    container.bind(token, {
      factory: () => {
        return {};
      },
      lifecycle: "singleton",
    });
    const first = container.get(token);
    const second = container.get(token);
    expect(first).toBe(second);
  });

  test("singleton class resolution", () => {
    class ContainerConcreteStub {}
    container.bind(ContainerConcreteStub, { lifecycle: "singleton" });

    const var1 = container.get(ContainerConcreteStub);
    const var2 = container.get(ContainerConcreteStub);
    expect(var1).toBe(var2);
  });

  test("singletonIf doesn't register if binding already registered", () => {
    const token = createKey<{ type: string }>();
    container.bind(token, {
      factory: () => ({ type: "a" }),
      lifecycle: "singleton",
    });
    const firstInstantiation = container.get(token);
    container.bind(token, {
      factory: () => ({ type: "b" }),
      lifecycle: "singleton",
      ifNotBound: true,
    });
    const secondInstantiation = container.get(token);
    expect(firstInstantiation).toBe(secondInstantiation);
    expect(firstInstantiation).toEqual({ type: "a" });
  });

  test("singletonIf does register if binding not registered yet", () => {
    const token = createKey();
    const otherToken = createKey<{ type: string }>();
    container.bind(token, { factory: () => ({}), lifecycle: "singleton" });
    container.bind(otherToken, {
      factory: () => ({ type: "a" }),
      lifecycle: "singleton",
      ifNotBound: true,
    });
    const firstInstantiation = container.get(otherToken);
    const secondInstantiation = container.get(otherToken);
    expect(firstInstantiation).toBe(secondInstantiation);
    expect(firstInstantiation).toEqual({ type: "a" });
  });

  test("scopedIf", async () => {
    const token = createKey<string>();
    container.bind(token, {
      factory: () => "foo",
      lifecycle: "scoped",
      ifNotBound: true,
    });

    await container.withScope(async () => {
      expect(container.get(token)).toBe("foo");
      container.bind(token, {
        factory: () => "bar",
        lifecycle: "scoped",
        ifNotBound: true,
      });
      expect(container.get(token)).toBe("foo");
      expect(container.get(token)).not.toBe("bar");
    });
  });

  test("auto concrete resolution", () => {
    class Foo {}
    expect(container.get(Foo)).toBeInstanceOf(Foo);
    expect(container.bound(Foo)).toBe(false);
  });

  test("bind fails loudly with invalid argument", () => {
    class Foo {}

    expect(() => {
      // @ts-expect-error asserting error for test
      container.bind(Foo, { factory: new Foo() });
    }).toThrowErrorMatchingInlineSnapshot(
      `"The factory property must be a function (object provided)"`,
    );

    expect(() => {
      // @ts-expect-error asserting error for test
      container.bind(Foo, { factory: Foo });
    }).toThrowErrorMatchingInlineSnapshot(
      `"The factory property must be a callable factory function (class constructor provided)"`,
    );
  });

  test("abstract to concrete resolution", () => {
    abstract class Parent {}
    class Child {}
    class Dependent {
      constructor(public impl = inject(Parent)) {}
    }

    container.bind(Parent, { factory: () => new Child() });
    const instance = container.get(Dependent);
    expect(instance.impl).toBeInstanceOf(Child);
  });

  test("nested dependency resolution", () => {
    interface Contract {
      _?: number;
    }
    const Contract = createKey<Contract>({ displayName: "Contract" });
    class Impl implements Contract {}
    class Dependent {
      constructor(public impl = inject(Contract)) {}
    }
    class NestedDependent {
      constructor(public inner = inject(Dependent)) {}
    }

    container.bind(Contract, { factory: () => new Impl() });
    const instance = container.get(NestedDependent);
    expect(instance.inner).toBeInstanceOf(Dependent);
    expect(instance.inner.impl).toBeInstanceOf(Impl);
  });

  test("container is passed to resolvers", () => {
    const token = createKey();
    container.bind(token, {
      factory: (c) => {
        return c;
      },
    });
    const c = container.get(token);
    expect(c).toBe(container);
  });

  test("binding an instance as shared", () => {
    class Foo {}
    const bound = new Foo();
    container.bind(Foo, { instance: bound, lifecycle: "singleton" });
    expect(container.get(Foo)).toBe(bound);
    expect(container.getLifecycle(Foo)).toBe("singleton");
  });

  test("lifecycle can be omitted when binding an instance", () => {
    class Foo {}
    const bound = new Foo();
    container.bind(Foo, { instance: bound });
    expect(container.get(Foo)).toBe(bound);
    expect(container.getLifecycle(Foo)).toBe("singleton");
  });

  test("resolution of default constructor arguments", () => {
    class Dependency {}
    class Dependent {
      constructor(
        public stub = inject(Dependency),
        public defaultVal = "Bernie",
      ) {}
    }

    const instance = container.get(Dependent);
    expect(instance.stub).toBeInstanceOf(Dependency);
    expect(instance.defaultVal).toBe("Bernie");
  });

  test("binding or making a class with non-default constructor args produces a type error", () => {
    class MandatoryArgs {
      constructor(public foo: string) {}
    }
    // @ts-expect-error asserting error for test
    container.bind(MandatoryArgs);
    // @ts-expect-error asserting error for test
    container.get(MandatoryArgs);
  });

  test("error on attempting to auto-resolve an abstract class", () => {
    interface I {
      foo: string;
    }
    const Parent = createKey<I>({ displayName: "I" });
    expect(() => container.get(Parent)).toThrowErrorMatchingInlineSnapshot(
      `"Can't create an instance of [I] because no value or factory function was supplied"`,
    );
  });

  test("resolution of class with optional dependency", () => {
    class OptionalInject {
      constructor(
        public noDefault = inject(Dep),
        public defaultVal = injectOptional(Dep),
      ) {}
    }

    const instance = container.get(OptionalInject);
    expect(instance.noDefault).toBeInstanceOf(Dep);
    expect(instance.defaultVal).toBe(null);

    container.bind(Dep, { factory: () => new Dep() });
    const instance2 = container.get(OptionalInject);
    expect(instance2.defaultVal).toBeInstanceOf(Dep);
  });

  test("resolution of class with optional dependency and contextual bindings", () => {
    class AltDep extends Dep {}
    class OptionalInject {
      constructor(
        public noDefault = inject(Dep),
        public defaultVal = injectOptional(Dep),
      ) {}
    }

    container
      .when(OptionalInject)
      .needs(Dep)
      .create(() => new AltDep());
    const instance = container.get(OptionalInject);
    expect(instance.defaultVal).toBeInstanceOf(AltDep);
  });

  test("bound", () => {
    class Foo {}
    const alias = createKey<Foo>();
    container.bind(Foo);
    expect(container.bound(Foo)).toBe(true);
    expect(container.bound(alias)).toBe(false);

    const container2 = new Container();
    container2.alias({ from: alias, to: Foo });
    expect(container2.bound(alias)).toBe(true);
    expect(container2.bound(Foo)).toBe(false);
  });

  test("alias clears binding", () => {
    class Foo {
      constructor(public string?: string) {}
    }
    const token = createKey<Foo>();
    container.bind(token, { factory: () => new Foo("bound by token") });
    container.bind(Foo, { factory: () => new Foo("bound by class") });
    expect(container.get(token).string).toBe("bound by token");
    expect(container.get(Foo).string).toBe("bound by class");

    container.alias({ from: token, to: Foo });
    expect(container.get(token).string).toBe("bound by class");
  });

  test("rebound listeners", () => {
    const token = createKey<string>();

    container.bind(token, { factory: () => "a" });

    let fireCount = 0;
    container.onRebinding(token, (instance, c) => {
      expect(instance).toBe("b");
      expect(c).toBe(container);
      ++fireCount;
    });
    container.bind(token, { factory: () => "b" });

    expect(fireCount).toBe(1);
  });

  test("rebound listeners only fires if was already bound", () => {
    const token = createKey<string>();

    let fireCount = 0;
    container.onRebinding(token, () => {
      ++fireCount;
    });
    container.bind(token, { factory: () => "b" });

    expect(fireCount).toBe(0);
  });

  test("rebound listeners on instances", () => {
    class Foo {}

    container.bind(Foo, { instance: new Foo(), lifecycle: "singleton" });

    let fireCount = 0;
    container.onRebinding(Foo, () => {
      ++fireCount;
    });
    container.bind(Foo, { instance: new Foo(), lifecycle: "singleton" });

    expect(fireCount).toBe(1);
  });

  test("rebound listeners on instances only fires if was already bound", () => {
    class Foo {}

    let fireCount = 0;
    container.onRebinding(Foo, () => {
      ++fireCount;
    });
    container.bind(Foo, { instance: new Foo(), lifecycle: "singleton" });

    expect(fireCount).toBe(0);
  });

  test("binding resolution exception message includes build stack", () => {
    class A {
      constructor(public b = inject(B)) {}
    }
    class B {
      constructor(public c = inject(C)) {}
    }
    const C = createKey({ displayName: "C" });

    expect(() => {
      container.get(A);
    }).toThrowErrorMatchingInlineSnapshot(
      `"Can't create an instance of [C] because no value or factory function was supplied (while building [A] -> [B])"`,
    );
  });

  test("currently resolving", () => {
    class Foo {
      key: KeyOrClass | null;
      constructor() {
        this.key = container.currentlyResolving();
      }
    }

    expect(new Foo().key).toBe(null);
    expect(container.get(Foo).key).toBe(Foo);
    const token = createKey<Foo>();
    container.bind(token, { factory: () => new Foo() });
    expect(container.get(token).key).toBe(token);
    container.bind(Foo);
    expect(container.get(Foo).key).toBe(Foo);
  });

  test("it throws exception when abstract is same as alias", () => {
    const token = createKey({ displayName: "tokenName" });
    expect(() => {
      container.alias({ from: token, to: token });
    }).toThrowErrorMatchingInlineSnapshot(`"[tokenName] is aliased to itself."`);
    class Foo {}
    expect(() => {
      container.alias({ from: Foo, to: Foo });
    }).toThrowErrorMatchingInlineSnapshot(`"[Foo] is aliased to itself."`);
  });

  test("call method with object and method name", () => {
    class Foo {
      getDepName(dep = inject(Dep)) {
        return dep.name;
      }
    }

    const name = container.call(new Foo(), "getDepName");

    expect(name).toBe("default");

    expect(() => new Foo().getDepName()).toThrowErrorMatchingInlineSnapshot(
      `"Dependencies that use inject() must be created by the container. See https://beynac.dev/xyz TODO make online explainer for this error and list causes and symptoms"`,
    );
  });

  test("call closure with dependency injection", () => {
    const result = container.call(() => {
      const dep = inject(Dep);
      return dep.name;
    });

    expect(result).toBe("default");

    // Without container.call, inject should throw
    expect(() => {
      const dep = inject(Dep);
      return dep.name;
    }).toThrowErrorMatchingInlineSnapshot(
      `"Dependencies that use inject() must be created by the container. See https://beynac.dev/xyz TODO make online explainer for this error and list causes and symptoms"`,
    );
  });

  test("call closure with custom bound dependency", () => {
    container.bind(Dep, { factory: () => new Dep("custom") });

    const result = container.call(() => {
      const dep = inject(Dep);
      return dep.name;
    });

    expect(result).toBe("custom");
  });

  test("call closure returns closure return value", () => {
    const result = container.call(() => {
      return { value: 42, nested: { data: "test" } };
    });

    expect(result).toEqual({ value: 42, nested: { data: "test" } });
  });

  test("call closure with no dependencies", () => {
    const result = container.call(() => "hello world");
    expect(result).toBe("hello world");
  });

  test("container can catch circular dependency", () => {
    class Root {
      constructor(public a: unknown = inject(A)) {}
    }
    class A {
      constructor(public b: unknown = inject(B)) {}
    }
    class B {
      constructor(public c: unknown = inject(C)) {}
    }
    class C {
      constructor(public a: unknown = inject(A)) {}
    }

    expect(() => container.get(Root)).toThrowErrorMatchingInlineSnapshot(
      `"Circular dependency detected: [A] -> [B] -> [C] -> [A] (while building [Root] -> [A] -> [B] -> [C])"`,
    );
  });
});

describe("Container contextual bindings", () => {
  test("contextual binding can provide different dependencies based on context", () => {
    const token = createKey<Dep>({ displayName: "Dep" });
    container.bind(token, { factory: () => new Dep("token") });

    class Class extends Dep {
      constructor() {
        super("class");
      }
    }

    class A {
      constructor(public dep = inject(Dep)) {}
    }
    class B {
      constructor(public dep = inject(Dep)) {}
    }
    class C {
      constructor(public dep = inject(Dep)) {}
    }
    class D {
      constructor(public dep = inject(Dep)) {}
    }

    container.when(A).needs(Dep).give(token);
    container.when(B).needs(Dep).give(Class);
    let createArg: unknown;
    container
      .when(C)
      .needs(Dep)
      .create((c) => {
        createArg = c;
        return new Dep("created");
      });

    expect(container.get(A).dep.name).toBe("token");
    expect(container.get(B).dep.name).toBe("class");
    expect(container.get(C).dep.name).toBe("created");
    expect(container.get(D).dep.name).toBe("default");
    expect(createArg).toBe(container);
  });

  test("contextual binding works for existing instanced bindings", () => {
    container.bind(Dep, {
      instance: new Dep("instance"),
      lifecycle: "singleton",
    });

    class A {
      constructor(public dep = inject(Dep)) {}
    }

    container
      .when(A)
      .needs(Dep)
      .create(() => new Dep("contextual"));

    expect(container.get(A).dep.name).toBe("contextual");
  });

  test("contextual binding works for key", () => {
    class A {
      constructor(public dep = inject(Dep)) {}
    }
    const token = createKey<A>();
    container.bind(token, { factory: () => new A() });

    container
      .when(token)
      .needs(Dep)
      .create(() => new Dep("contextual"));

    expect(container.get(token).dep.name).toBe("contextual");
  });

  test("contextual binding works for aliased key already created", () => {
    class A {
      constructor(public dep = inject(Dep)) {}
    }
    const alias = createKey<A>();
    const token = createKey<A>();
    container.bind(token, { factory: () => new A() });
    container.alias({ from: alias, to: token });

    container
      .when(token)
      .needs(Dep)
      .create(() => new Dep("contextual"));

    expect(container.get(token).dep.name).toBe("contextual");
  });

  test("contextual binding works for aliased key created later", () => {
    class A {
      constructor(public dep = inject(Dep)) {}
    }
    const alias = createKey<A>();
    const token = createKey<A>();

    container
      .when(token)
      .needs(Dep)
      .create(() => new Dep("contextual"));

    container.bind(token, { factory: () => new A() });
    container.alias({ from: alias, to: token });

    expect(container.get(token).dep.name).toBe("contextual");
  });

  test("can contextually override with null", () => {
    const token = createKey<Dep | null>();
    class B {
      constructor(public dep = inject(token)) {}
    }
    class A {
      constructor(public dep = inject(token)) {}
    }
    container.bind(token, { factory: () => new Dep() });

    container
      .when(A)
      .needs(token)
      .create(() => null);

    expect(container.get(A).dep).toBe(null);
    expect(container.get(B).dep).toBeInstanceOf(Dep);
  });

  test("contextual binding works for newly instanced bindings", () => {
    class A {
      constructor(public dep = inject(Dep)) {}
    }

    container
      .when(A)
      .needs(Dep)
      .create(() => new Dep("override"));

    container.bind(Dep, {
      instance: new Dep("instance"),
      lifecycle: "singleton",
    });

    expect(container.get(A).dep.name).toBe("override");
  });

  test("contextual binding works on existing aliased instances", () => {
    const instance = createKey<Dep>({ displayName: "instance" });
    container.bind(instance, {
      instance: new Dep("instance"),
    });
    const alias = createKey<Dep>({ displayName: "alias" });
    container.alias({ from: alias, to: instance });

    class A {
      constructor(public dep = inject(alias)) {}
    }

    container
      .when(A)
      .needs(alias)
      .create(() => new Dep("override"));

    expect(container.get(A).dep.name).toBe("override");
  });

  test("contextual binding can replace an instance with null", () => {
    const instance = createKey<Dep | null>({ displayName: "instance" });
    container.bind(instance, {
      instance: new Dep("instance"),
      lifecycle: "singleton",
    });
    const alias = createKey<Dep | null>({ displayName: "alias" });
    container.alias({ from: alias, to: instance });

    class A {
      constructor(public dep = inject(alias)) {}
    }

    container
      .when(A)
      .needs(alias)
      .create(() => null);

    expect(container.get(A).dep).toBe(null);
  });

  test("contextual binding works on new aliased instances", () => {
    const instance = createKey<Dep>({ displayName: "instance" });
    const alias = createKey<Dep>({ displayName: "alias" });

    class A {
      constructor(public dep = inject(alias)) {}
    }

    container
      .when(A)
      .needs(alias)
      .create(() => new Dep("override"));

    container.bind(instance, {
      instance: new Dep("instance"),
      lifecycle: "singleton",
    });
    container.alias({ from: alias, to: instance });

    expect(container.get(A).dep.name).toBe("override");
  });

  test("contextual binding does not pick up stale re-aliased references", () => {
    const dummy = createKey<Dep>({ displayName: "dummy" });
    const alias = createKey<Dep>({ displayName: "alias" });
    const unrelated = createKey<Dep>({ displayName: "unrelated" });
    const instance = createKey<Dep>({ displayName: "instance" });

    class A {
      constructor(public dep = inject(alias)) {}
    }

    container
      .when(A)
      .needs(dummy)
      .create(() => new Dep("bad override"));

    container
      .when(A)
      .needs(alias)
      .create(() => new Dep("good override"));

    container.bind(instance, {
      instance: new Dep("instance"),
      lifecycle: "singleton",
    });
    container.alias({ from: dummy, to: instance });
    container.alias({ from: alias, to: instance });
    container.alias({ from: dummy, to: unrelated });

    expect(container.get(A).dep.name).toBe("good override");
  });

  test("contextual binding works on new aliased bindings", () => {
    class A {
      constructor(public dep = inject(Dep)) {}
    }
    const stub = createKey<Dep>({ displayName: "stub" });

    container
      .when(A)
      .needs(stub)
      .create(() => new Dep("correct"));

    container.bind(Dep, { factory: () => new Dep("incorrect") });
    container.bind(stub, { factory: () => new Dep("incorrect") });
    container.alias({ from: Dep, to: stub });

    expect(container.get(A).dep.name).toBe("correct");
  });

  test("contextual binding works on existing aliased bindings", () => {
    class A {
      constructor(public dep = inject(Dep)) {}
    }

    const stub = createKey<Dep>({ displayName: "stub" });
    container.bind(Dep, { factory: () => new Dep("incorrect") });
    container.bind(stub, { factory: () => new Dep("incorrect") });
    container.alias({ from: Dep, to: stub });

    container
      .when(A)
      .needs(Dep)
      .create(() => new Dep("correct"));

    expect(container.get(A).dep.name).toBe("correct");
  });

  test("contextual binding works for multiple classes", () => {
    class A {
      constructor(public dep = inject(Dep)) {}
    }
    class B {
      constructor(public dep = inject(Dep)) {}
    }
    class C {
      constructor(public dep = inject(Dep)) {}
    }

    container
      .when([A, B])
      .needs(Dep)
      .create(() => new Dep("correct"));

    expect(container.get(A).dep.name).toBe("correct");
    expect(container.get(B).dep.name).toBe("correct");
    expect(container.get(C).dep.name).toBe("default");
  });

  test("contextual binding doesn't override non-contextual resolution", () => {
    class A {
      constructor(public dep = inject(Dep)) {}
    }
    class B {
      constructor(public dep = inject(Dep)) {}
    }

    container
      .when(A)
      .needs(Dep)
      .create(() => new Dep("contextual"));

    expect(container.get(A).dep.name).toBe("contextual");

    expect(container.get(B).dep.name).toBe("default");
  });

  test("contextual binding doesn't override non-contextual resolution of aliases", () => {
    const stub = createKey<Dep>();
    container.bind(stub, { instance: new Dep("stub"), lifecycle: "singleton" });
    container.alias({ from: Dep, to: stub });

    class A {
      constructor(public dep = inject(Dep)) {}
    }
    class B {
      constructor(public dep = inject(Dep)) {}
    }

    container
      .when(A)
      .needs(Dep)
      .create(() => new Dep("contextual"));

    expect(container.get(A).dep.name).toBe("contextual");

    expect(container.get(B).dep.name).toBe("stub");
  });

  test("contextually bound instances are not unnecessarily recreated", () => {
    const otherDep = createKey();

    class A {
      constructor(public dep = inject(otherDep)) {}
    }

    container.bind(Dep, { instance: new Dep(), lifecycle: "singleton" });
    container.bind(otherDep, { instance: "other", lifecycle: "singleton" });

    expect(Dep.instantiations).toBe(1);

    container.when(A).needs(otherDep).give(Dep);

    container.get(A);
    container.get(A);

    expect(Dep.instantiations).toBe(1);
  });

  test("container can inject simple variable", () => {
    const numberToken = createKey<number>();

    class A {
      constructor(public number = inject(numberToken)) {}
    }
    container
      .when(A)
      .needs(numberToken)
      .create(() => 100);

    const instance = container.get(A);
    expect(instance.number).toBe(100);
  });

  test("contextual binding works with aliased targets", () => {
    container.bind(Dep, { factory: () => new Dep("bound") });
    const alias = createKey<Dep>({ displayName: "alias" });
    container.alias({ from: alias, to: IDep });

    class A {
      constructor(public dep = inject(IDep)) {}
    }
    class B {
      constructor(public dep = inject(IDep)) {}
    }

    container
      .when(A)
      .needs(alias)
      .create(() => new Dep("via alias"));
    container.when(B).needs(alias).give(Dep);

    expect(container.get(A).dep.name).toBe("via alias");
    expect(container.get(B).dep.name).toBe("bound");
  });

  test("contextual binding works for method invocation", () => {
    class A {
      f(arg = inject(Dep)) {
        return arg.name;
      }
    }

    container
      .when(A)
      .needs(Dep)
      .create(() => new Dep("contextual"));

    const result = container.call(new A(), "f");
    expect(result).toBe("contextual");
  });
});

describe("Container tagging", () => {
  test("container tags", () => {
    class A {}
    class B {}
    const foo = createKey({ displayName: "foo" });
    const bar = createKey({ displayName: "bar" });

    container.tag(A, [foo, bar]);
    container.tag(B, [foo]);

    const fooResults = [...container.tagged(foo)];

    const barResults = [...container.tagged(bar)];

    expect(fooResults).toHaveLength(2);
    expect(fooResults[0]).toBeInstanceOf(A);
    expect(fooResults[1]).toBeInstanceOf(B);
    expect(barResults).toHaveLength(1);
    expect(barResults[0]).toBeInstanceOf(A);

    const container2 = new Container();
    container2.tag([A, B], [foo]);

    const fooResults2 = [...container2.tagged(foo)];
    expect(fooResults2).toHaveLength(2);
    expect(fooResults2[0]).toBeInstanceOf(A);
    expect(fooResults2[1]).toBeInstanceOf(B);

    expect([...container2.tagged(bar)]).toHaveLength(0);
  });

  test("tagged services are lazy loaded", () => {
    class A extends Dep {}
    class B extends Dep {}

    const foo = createKey({ displayName: "foo" });

    container.tag(A, foo);
    container.tag(B, foo);

    const iterator = container.tagged(foo);

    expect(Dep.instantiations).toBe(0);
    expect(iterator.next().value).toBeInstanceOf(A);
    expect(Dep.instantiations).toBe(1);
    expect(iterator.next().value).toBeInstanceOf(B);
    expect(Dep.instantiations).toBe(2);
    expect(iterator.next().done).toBe(true);
  });

  test("tagged services can be converted to array", () => {
    class A extends Dep {}
    class B extends Dep {}

    const foo = createKey({ displayName: "foo" });

    container.tag(A, foo);
    container.tag(B, foo);

    const from = Array.from(container.tagged(foo));
    expect(from).toHaveLength(2);
    expect(from[0]).toBeInstanceOf(A);
    expect(from[1]).toBeInstanceOf(B);

    const spread = [...container.tagged(foo)];
    expect(spread).toHaveLength(2);
    expect(spread[0]).toBeInstanceOf(A);
    expect(spread[1]).toBeInstanceOf(B);
  });

  test("lazy loaded tagged services can be looped over", () => {
    class A extends Dep {}
    class B extends Dep {}

    const foo = createKey({ displayName: "foo" });

    container.tag(A, foo);
    container.tag(B, foo);

    const iter = container.tagged(foo);
    let count = 0;
    for (const _ of iter) {
      ++count;
    }
    expect(count).toBe(2);
  });
});

describe("Container extend", () => {
  test("extended bindings", () => {
    const fooKey = createKey<string>({ displayName: "foo" });
    container.bind(fooKey, { instance: "foo", lifecycle: "singleton" });
    container.extend(fooKey, (old) => {
      return `${old} extended`;
    });

    expect(container.get(fooKey)).toBe("foo extended");

    const container2 = new Container();
    const objKey = createKey<{ name: string; age?: number }>({
      displayName: "obj",
    });

    container2.bind(objKey, {
      factory: () => {
        return { name: "Bernie" };
      },
      lifecycle: "singleton",
    });
    container2.extend(objKey, (old) => {
      old.age = 44;
      return old;
    });

    const result = container2.get(objKey);

    expect(result.name).toBe("Bernie");
    expect(result.age).toBe(44);
    expect(container2.get(objKey)).toBe(result);
  });

  test("extended bindings work with contextual overrides", () => {
    const fooKey = createKey<string>({ displayName: "foo" });
    container.bind(fooKey, { instance: "foo", lifecycle: "singleton" });
    container.extend(fooKey, (old) => {
      return `${old} extended`;
    });

    class A {
      constructor(public foo = inject(fooKey)) {}

      m(foo = inject(fooKey)) {
        return foo;
      }
    }

    container
      .when(A)
      .needs(fooKey)
      .create(() => "bar");

    expect(container.get(A).foo).toBe("bar extended");
    expect(container.call(new A(""), "m")).toBe("bar extended");
  });

  test("extend instances are preserved", () => {
    type T = Record<string, string>;

    const fooKey = createKey<T>({ displayName: "foo" });
    container.bind(fooKey, {
      factory: () => {
        const obj: T = {};
        obj.foo = "bar";
        return obj;
      },
    });

    const obj: T = {};
    obj.foo = "foo";
    container.bind(fooKey, { instance: obj, lifecycle: "singleton" });
    container.extend(fooKey, (obj) => {
      obj.bar = "baz";
      return obj;
    });
    container.extend(fooKey, (obj) => {
      obj.baz = "foo";
      return obj;
    });

    expect(container.get(fooKey).foo).toBe("foo");
    expect(container.get(fooKey).bar).toBe("baz");
    expect(container.get(fooKey).baz).toBe("foo");
  });

  test("extend is lazy initialized", () => {
    class Lazy {
      static initialized = false;
      init() {
        Lazy.initialized = true;
      }
    }

    Lazy.initialized = false;

    container.bind(Lazy);
    container.extend(Lazy, (obj) => {
      obj.init();
      return obj;
    });
    expect(Lazy.initialized).toBe(false);
    container.get(Lazy);
    expect(Lazy.initialized).toBe(true);
  });

  test("extend can be called before bind", () => {
    const fooKey = createKey<string>({ displayName: "foo" });
    container.extend(fooKey, (old) => {
      return `${old} bar`;
    });
    container.bind(fooKey, { instance: "foo", lifecycle: "singleton" });

    expect(container.get(fooKey)).toBe("foo bar");
  });

  test("extend instance rebinding callback", () => {
    let testRebind = false;

    const fooKey = createKey<object>({ displayName: "foo" });
    container.onRebinding(fooKey, () => {
      testRebind = true;
    });

    const obj = {};
    container.bind(fooKey, { instance: obj, lifecycle: "singleton" });

    container.extend(fooKey, (obj) => {
      return obj;
    });

    expect(testRebind).toBe(true);
  });

  test("can extend transient with null", () => {
    const token = createKey<string | null>();
    container.bind(token, { instance: "hello" });
    expect(container.get(token)).toBe("hello");
    container.extend(token, () => null);
    expect(container.get(token)).toBe(null);
  });

  test("can extend singleton with null", () => {
    const token = createKey<string | null>();
    const factory = mock(() => "hello");
    container.bind(token, { factory, lifecycle: "singleton" });
    expect(container.get(token)).toBe("hello");
    expect(container.get(token)).toBe("hello");
    expect(factory).toHaveBeenCalledTimes(1);
    const extender = mock(() => null);
    container.extend(token, extender);
    expect(container.get(token)).toBe(null);
    expect(container.get(token)).toBe(null);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(extender).toHaveBeenCalledTimes(1);
  });

  test("extend bind rebinding callback", () => {
    let testRebind = false;

    const fooKey = createKey<object>({ displayName: "foo" });
    container.onRebinding(fooKey, () => {
      testRebind = true;
    });
    container.bind(fooKey, {
      factory: () => {
        return {};
      },
    });

    expect(testRebind).toBe(false);

    container.get(fooKey);

    container.extend(fooKey, (obj) => {
      return obj;
    });

    expect(testRebind).toBe(true);
  });

  test("extension works on aliased bindings", () => {
    const somethingKey = createKey<string>();
    const aliasKey = createKey<string>();
    container.bind(somethingKey, {
      factory: () => {
        return "some value";
      },
      lifecycle: "singleton",
    });
    container.alias({ from: aliasKey, to: somethingKey });
    container.extend(aliasKey, (value) => {
      return `${value} extended`;
    });

    expect(container.get(somethingKey)).toBe("some value extended");
  });

  test("extension works on binding that will be aliased later", () => {
    const somethingKey = createKey<string>();
    const aliasKey = createKey<string>();
    container.bind(somethingKey, {
      factory: () => {
        return "some value";
      },
      lifecycle: "singleton",
    });
    container.extend(aliasKey, (value) => {
      return `${value} extended`;
    });
    container.alias({ from: aliasKey, to: somethingKey });

    expect(container.get(somethingKey)).toBe("some value extended");
  });

  test("extension works on binding that will be deeply aliased later", () => {
    const somethingKey = createKey();
    const aliasKey = createKey();
    const deepAliasKey = createKey();
    container.bind(somethingKey, {
      factory: () => {
        return "some value";
      },
      lifecycle: "singleton",
    });
    container.extend(deepAliasKey, (value) => {
      return `${value} extended`;
    });
    container.alias({ from: aliasKey, to: somethingKey });
    container.alias({ from: deepAliasKey, to: aliasKey });

    expect(container.get(somethingKey)).toBe("some value extended");
  });

  test("multiple extends", () => {
    const fooKey = createKey<string>({ displayName: "foo" });
    container.bind(fooKey, { instance: "foo", lifecycle: "singleton" });
    container.extend(fooKey, (old) => {
      return `${old} bar`;
    });
    container.extend(fooKey, (old) => {
      return `${old} baz`;
    });

    expect(container.get(fooKey)).toBe("foo bar baz");
  });

  test("extend contextual binding", () => {
    class A {
      constructor(public dep = inject(Dep)) {}
    }
    class AltDep {
      constructor(public name = "alt-default") {}
    }

    container.when(A).needs(Dep).give(AltDep);

    container.extend(AltDep, (instance) => {
      return new AltDep(`extended ${instance.name}`);
    });

    expect(container.get(A).dep.name).toBe("extended alt-default");
  });

  test("extend contextual binding after resolution", () => {
    interface I {
      value: string;
    }
    const I = createKey<I>({ displayName: "I" });
    class Impl implements I {
      constructor(public value: string) {}
    }
    class Consumer {
      constructor(public stub = inject(I)) {}
    }

    container
      .when(Consumer)
      .needs(I)
      .create(() => new Impl("foo"));

    container.get(Consumer);

    container.extend(I, (instance) => {
      expect(instance).toBeInstanceOf(Impl);
      expect(instance.value).toBe("foo");

      return new Impl("bar");
    });

    expect(container.get(Consumer).stub.value).toBe("bar");
  });
});

describe("Container resolving callbacks", () => {
  test("resolving callbacks are called for classes", () => {
    const callback = mock();
    container.onResolving(Dep, callback);
    const dep = new Dep("hello");
    container.bind(Dep, { factory: () => dep });

    container.get(Dep);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith(dep, container);
    container.get(Dep);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test("resolving callbacks are called for tokens", () => {
    const token = createKey<string>();
    const callback = mock();
    container.onResolving(token, callback);
    container.bind(token, { factory: () => "hello" });
    container.get(token);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith("hello", container);
  });

  test("resolving callbacks are not called for other abstracts", () => {
    class Other {
      name?: string;
    }
    const token = createKey<Dep>();
    const callback = mock();
    container.onResolving(Other, callback);
    container.bind(token, { factory: () => new Dep("hello") });
    container.get(token);

    expect(callback).not.toHaveBeenCalled();
  });

  test("resolving callbacks are called for type", () => {
    class A {}
    const token = createKey();
    const callback = mock();
    container.onResolving(A, callback);
    container.bind(token, { factory: () => new A() });

    container.get(token);
    expect(callback).toHaveBeenCalledTimes(1);
    container.get(token);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  test("resolving callbacks are called for parent types", () => {
    class Parent {}
    class Child extends Parent {}
    const token = createKey();
    const callback = mock();
    container.onResolving(Parent, callback);
    container.bind(token, { factory: () => new Child() });

    container.get(token);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("resolving callbacks on Object are called for any instance", () => {
    class A {}
    const token = createKey();
    const callback = mock();
    container.onResolving(Object, callback);
    container.bind(token, { factory: () => new A() });

    container.get(token);

    expect(callback).toHaveBeenCalledTimes(1);

    // not called for null prototype objects
    container.bind(token, { factory: () => Object.create(null) });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("resolving callbacks are not called for child types", () => {
    class Parent {}
    class Child extends Parent {}
    const token = createKey();
    const callback = mock();
    container.onResolving(Child, callback);
    container.bind(token, { factory: () => new Parent() });

    container.get(token);

    expect(callback).toHaveBeenCalledTimes(0);
  });

  test("resolving callbacks are called once for singleton concretes", () => {
    const depKey = createKey<Dep>();
    const depCallback = mock();
    const keyCallback = mock();
    container.onResolving(Dep, depCallback);
    container.onResolving(depKey, keyCallback);

    container.bind(depKey, { factory: () => new Dep() });
    container.bind(Dep);

    container.get(depKey);
    expect(depCallback).toHaveBeenCalledTimes(1);
    expect(keyCallback).toHaveBeenCalledTimes(1);

    container.get(Dep);
    expect(depCallback).toHaveBeenCalledTimes(2);
    expect(keyCallback).toHaveBeenCalledTimes(1);

    container.get(Dep);
    expect(depCallback).toHaveBeenCalledTimes(3);
    expect(keyCallback).toHaveBeenCalledTimes(1);
  });

  test("resolving callbacks can still be added after the first resolution", () => {
    container.bind(Dep);
    container.get(Dep);

    const callback = mock();
    container.onResolving(Dep, callback);

    container.get(Dep);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("resolving callbacks are called when rebind happens", () => {
    const token = createKey<Dep>();

    const resolvingCallback = mock();
    container.onResolving(token, resolvingCallback);
    const rebindingCallback = mock();
    container.onRebinding(token, rebindingCallback);

    container.bind(token, { factory: () => new Dep("A") });

    container.get(token);

    expect(resolvingCallback).toHaveBeenCalledTimes(1);
    expect(rebindingCallback).toHaveBeenCalledTimes(0);

    container.bind(token, { factory: () => new Dep("B") });
    expect(resolvingCallback).toHaveBeenCalledTimes(2);
    expect(rebindingCallback).toHaveBeenCalledTimes(1);

    container.get(token);
    expect(resolvingCallback).toHaveBeenCalledTimes(3);
    expect(rebindingCallback).toHaveBeenCalledTimes(1);

    container.bind(token, { factory: () => new Dep("C") });
    expect(resolvingCallback).toHaveBeenCalledTimes(4);
    expect(rebindingCallback).toHaveBeenCalledTimes(2);
  });

  test("resolving callbacks aren't called when no re-bindings are registered", () => {
    const token = createKey<Dep>();

    const resolvingCallback = mock();
    container.onResolving(token, resolvingCallback);

    container.bind(token, { factory: () => new Dep("A") });

    container.get(token);

    expect(resolvingCallback).toHaveBeenCalledTimes(1);

    container.bind(token, { factory: () => new Dep("B") });
    expect(resolvingCallback).toHaveBeenCalledTimes(1);

    container.get(token);
    expect(resolvingCallback).toHaveBeenCalledTimes(2);

    container.bind(token, { factory: () => new Dep("C") });
    expect(resolvingCallback).toHaveBeenCalledTimes(2);

    container.get(token);
    expect(resolvingCallback).toHaveBeenCalledTimes(3);
  });

  test("rebinding does not affect multiple resolving callbacks", () => {
    class A {}
    class B extends A {}
    class C {}
    const callback = mock();

    container.onResolving(A, callback);
    container.onResolving(B, callback);

    container.bind(A);

    // it should call the callback for interface
    container.get(A);
    expect(callback).toHaveBeenCalledTimes(1);

    container.bind(A, { factory: () => new C() });

    // it should call the callback for interface
    container.get(A);
    expect(callback).toHaveBeenCalledTimes(2);

    // should call the callback for the interface it implements
    // plus the callback for ResolvingImplementationStubTwo.
    container.get(B);
    expect(callback).toHaveBeenCalledTimes(4);
  });

  test("resolving callbacks are called for parent and child classes when a child is made", () => {
    class Parent {}
    class Child extends Parent {}

    const childCallback = mock();
    const parentCallback = mock();
    container.onResolving(Child, childCallback);
    container.onResolving(Parent, parentCallback);

    container.bind(Child, { factory: () => new Child() });

    container.get(Child);

    expect(childCallback).toHaveBeenCalledTimes(1);
    expect(parentCallback).toHaveBeenCalledTimes(1);
  });

  test("resolving callbacks are called for parent and child classes when a parent is made providing an instance of the child", () => {
    class Parent {}
    class Child extends Parent {}

    const childCallback = mock();
    const parentCallback = mock();
    container.onResolving(Child, childCallback);
    container.onResolving(Parent, parentCallback);

    container.bind(Parent, { factory: () => new Child() });

    container.get(Parent);

    expect(childCallback).toHaveBeenCalledTimes(1);
    expect(parentCallback).toHaveBeenCalledTimes(1);
  });

  test("resolving callbacks are called for parent class and not child class when a parent is made", () => {
    class Parent {}
    class Child extends Parent {}

    const childCallback = mock();
    const parentCallback = mock();
    container.onResolving(Child, childCallback);
    container.onResolving(Parent, parentCallback);

    container.bind(Parent, { factory: () => new Parent() });

    container.get(Parent);

    expect(childCallback).toHaveBeenCalledTimes(0);
    expect(parentCallback).toHaveBeenCalledTimes(1);
  });

  test("resolving callbacks are called for concretes when attached on concretes", () => {
    class A {}
    class B {}

    const aCallback = mock();
    const bCallback = mock();
    container.onResolving(A, aCallback);
    container.onResolving(B, bCallback);

    container.bind(A, { factory: () => new B() });

    container.get(A);

    expect(aCallback).toHaveBeenCalledTimes(1);
    expect(bCallback).toHaveBeenCalledTimes(1);
  });

  test("resolving callbacks are called for concretes with no binding", () => {
    class A {}

    const callback = mock();
    container.onResolving(A, callback);

    container.get(A);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("resolving callbacks are called for keys with no binding injected contextually", () => {
    const token = createKey();

    class A {
      constructor(public dep = inject(token)) {}
    }

    container
      .when(A)
      .needs(token)
      .create(() => "hello");

    const callback = mock();
    container.onResolving(token, callback);

    container.get(A);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  test("resolving callbacks are called for classes with no binding injected contextually", () => {
    class B {}
    class C {}

    class A {
      constructor(public dep = inject(B)) {}
    }

    container
      .when(A)
      .needs(B)
      .create(() => new C());

    const aCallback = mock();
    container.onResolving(A, aCallback);
    const bCallback = mock();
    container.onResolving(B, bCallback);
    const cCallback = mock();
    container.onResolving(C, cCallback);

    container.get(A);

    expect(aCallback).toHaveBeenCalledTimes(1);
    expect(bCallback).toHaveBeenCalledTimes(1);
    expect(cCallback).toHaveBeenCalledTimes(1);
  });
});

describe("Container withScope", () => {
  test("scoped type token resolution throws outside scope", () => {
    const token = createKey({ displayName: "token" });
    container.bind(token, {
      factory: () => {
        return {};
      },
      lifecycle: "scoped",
    });
    expect(() => container.get(token)).toThrowErrorMatchingInlineSnapshot(
      `"Cannot create [token] because it is scoped so can only be accessed within a request or job. See https://beynac.dev/xyz TODO make online explainer for this error and list causes and symptoms"`,
    );
  });

  test("scoped class reference resolution throws outside scope", () => {
    class Foo {}
    container.bind(Foo, { lifecycle: "scoped" });
    expect(() => container.get(Foo)).toThrowErrorMatchingInlineSnapshot(
      `"Cannot create [Foo] because it is scoped so can only be accessed within a request or job. See https://beynac.dev/xyz TODO make online explainer for this error and list causes and symptoms"`,
    );
  });

  test("scoped bindings work within withScope", async () => {
    class Database {}
    container.bind(Database, { lifecycle: "scoped" });

    expect(container.getLifecycle(Database)).toBe("scoped");

    const result = await container.withScope(async () => {
      const db1 = container.get(Database);
      const db2 = container.get(Database);
      expect(db1).toBe(db2); // Same instance within scope
      return db1;
    });

    expect(result).toBeInstanceOf(Database);
  });

  test("scoped bindings work with contextual bindings", async () => {
    class Database {
      constructor(public dep = inject(Dep)) {}
    }
    container.bind(Database, { lifecycle: "scoped" });

    container
      .when(Database)
      .needs(Dep)
      .create(() => new Dep("contextual"));

    const result = await container.withScope(async () => {
      const db1 = container.get(Database);
      const db2 = container.get(Database);
      expect(db1).toBe(db2); // Same instance within scope
      expect(db1.dep.name).toBe("contextual");
      return db1;
    });

    expect(result).toBeInstanceOf(Database);
  });

  test("different scopes get different instances", async () => {
    class Database {}
    container.bind(Database, { lifecycle: "scoped" });

    const [db1, db2] = await Promise.all([
      container.withScope(async () => container.get(Database)),
      container.withScope(async () => container.get(Database)),
    ]);

    expect(db1).not.toBe(db2);
  });

  test("nested scopes are isolated", async () => {
    class Database {}
    container.bind(Database, { lifecycle: "scoped" });

    await container.withScope(async () => {
      const outerDb = container.get(Database);

      await container.withScope(async () => {
        const innerDb = container.get(Database);
        expect(innerDb).not.toBe(outerDb); // Different scope
      });

      const outerDb2 = container.get(Database);
      expect(outerDb2).toBe(outerDb); // Same scope
    });
  });

  test("scoped instances are isolated across concurrent async operations", async () => {
    const gate = asyncGate(["start"]);
    let idCounter = 0;
    class Database {
      id: number;
      constructor() {
        this.id = ++idCounter;
      }
    }
    container.bind(Database, { lifecycle: "scoped" });

    const results: Database[] = [];

    const scope1 = gate.task("scope1");
    const scope2 = gate.task("scope2");

    const task1 = container.withScope(async () => {
      await scope1("start");
      const db = container.get(Database);
      results[0] = db;
      return db;
    });

    const task2 = container.withScope(async () => {
      await scope2("start");
      const db = container.get(Database);
      results[1] = db;
      return db;
    });

    // Start both scopes
    const p1 = task1;
    const p2 = task2;

    // Let them start
    await gate.run();

    await Promise.all([p1, p2]);

    expect(results[0]).toBeDefined();
    expect(results[1]).toBeDefined();
    expect(results[0]).not.toBe(results[1]);
    expect(results[0]?.id).not.toBe(results[1]?.id);
  });

  test("scope propagates through async function calls", async () => {
    class Logger {
      logs: string[] = [];
    }
    container.bind(Logger, { lifecycle: "scoped" });

    async function doWork(message: string) {
      const logger = container.get(Logger);
      logger.logs.push(message);
      await Promise.resolve();
      return logger;
    }

    await container.withScope(async () => {
      const logger1 = await doWork("first");
      const logger2 = await doWork("second");

      expect(logger1).toBe(logger2);
      expect(logger1.logs).toEqual(["first", "second"]);
    });
  });

  test("scoped bindings work alongside singleton and transient", async () => {
    class Singleton {}
    class Scoped {}
    class Transient {}

    container.bind(Singleton, { lifecycle: "singleton" });
    container.bind(Scoped, { lifecycle: "scoped" });
    container.bind(Transient);

    const results = await container.withScope(async () => {
      return {
        singleton1: container.get(Singleton),
        singleton2: container.get(Singleton),
        scoped1: container.get(Scoped),
        scoped2: container.get(Scoped),
        transient1: container.get(Transient),
        transient2: container.get(Transient),
      };
    });

    expect(results.singleton1).toBe(results.singleton2);
    expect(results.scoped1).toBe(results.scoped2);
    expect(results.transient1).not.toBe(results.transient2);
  });

  test("same scope returns same instance across async operations", async () => {
    class Database {
      id: number;
      constructor() {
        this.id = ++idCounter;
      }
    }
    let idCounter = 0;
    container.bind(Database, { lifecycle: "scoped" });

    await container.withScope(async () => {
      const db1 = container.get(Database);

      // Do some async work
      await Promise.resolve();

      const db2 = container.get(Database);

      // Do more async work
      await Promise.resolve();

      const db3 = container.get(Database);

      // All should be the same instance
      expect(db1).toBe(db2);
      expect(db2).toBe(db3);
      expect(db1.id).toBe(1);
      expect(idCounter).toBe(1); // Constructor only called once
    });
  });

  test("same scope returns same instance at different async checkpoints", async () => {
    const gate = asyncGate(["first-access", "second-access", "third-access"]);

    class Logger {
      logs: string[] = [];
    }
    container.bind(Logger, { lifecycle: "scoped" });

    // Start the scope task
    const scopeTask = container.withScope(async () => {
      await gate("first-access");
      const logger1 = container.get(Logger);
      logger1.logs.push("first");

      await gate("second-access");

      // Critical test: AsyncLocalStorage context should survive setTimeout
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          const logger2 = container.get(Logger);
          logger2.logs.push("second");

          // Verify it's the same instance even inside setTimeout callback
          expect(logger2).toBe(logger1);
          resolve();
        }, 0);
      });

      await gate("third-access");
      const logger3 = container.get(Logger);
      logger3.logs.push("third");

      // All should be the same instance
      expect(logger1).toBe(logger3);
      expect(logger1.logs).toEqual(["first", "second", "third"]);
    });

    // Drive the test forward while the scope task is running
    await gate.run();

    // Wait for the scope task to complete
    await scopeTask;
  });

  test("scoped instances are isolated even when scopes overlap", async () => {
    const gate = asyncGate(["scope1-created", "scope2-created", "scope1-exit"]);

    class Database {
      id: number;
      constructor() {
        this.id = ++idCounter;
      }
    }
    let idCounter = 0;
    container.bind(Database, { lifecycle: "scoped" });

    const scope1 = gate.task("scope1");
    const scope2 = gate.task("scope2");

    let db1: Database | undefined;
    let db2: Database | undefined;

    // Start scope 1
    const task1 = container.withScope(async () => {
      db1 = container.get(Database);
      await scope1("scope1-created");
      // Hold this scope open until released
      await scope1("scope1-exit");
      return db1;
    });

    // Start scope 2
    const task2 = container.withScope(async () => {
      await scope2("scope2-created");
      db2 = container.get(Database);
      return db2;
    });

    const p1 = task1;
    const p2 = task2;

    // Verify initial state - both tasks should be waiting
    expect(gate.current("scope1")).toBe("scope1-created");
    expect(gate.current("scope2")).toBe("scope2-created");

    // Let scope1 create its instance
    await gate.next(); // scope1-created

    // Verify scope1 has created its instance and is now waiting to exit
    expect(gate.current("scope1")).toBe("scope1-exit");
    expect(gate.current("scope2")).toBe("scope2-created"); // scope2 still waiting
    expect(db1).toBeDefined();
    expect(db1?.id).toBe(1);

    // Now let scope2 create its instance while scope1 is still active
    await gate.next(); // scope2-created

    // Verify scope2 has created its instance while scope1 is still active
    expect(gate.current("scope1")).toBe("scope1-exit"); // scope1 still waiting to exit
    expect(gate.current("scope2")).toBe(null); // scope2 completed
    expect(db2).toBeDefined();
    expect(db2?.id).toBe(2);

    // Verify they got different instances even though scope1 is still active
    expect(db1).not.toBe(db2);

    // Let scope1 exit
    await gate.next(); // scope1-exit

    // Verify both tasks have completed
    expect(gate.current("scope1")).toBe(null);
    expect(gate.current("scope2")).toBe(null);

    await Promise.all([p1, p2]);
  });
});

describe("Container default values", () => {
  describe("get()", () => {
    test("returns default when key not bound", () => {
      const container = new Container();
      const keyWithDefault = createKey<string>({
        displayName: "test",
        default: "defaultValue",
      });

      const result = container.get(keyWithDefault);
      expect(result).toBe("defaultValue");
    });

    test("returns bound value over default", () => {
      const container = new Container();
      const keyWithDefault = createKey<string>({
        displayName: "test",
        default: "defaultValue",
      });

      container.bind(keyWithDefault, { instance: "boundValue" });

      const result = container.get(keyWithDefault);
      expect(result).toBe("boundValue");
    });

    test("throws for key without explicit default and no binding", () => {
      const container = new Container();
      const keyWithoutDefault = createKey<string>({ displayName: "test" });

      // Keys without explicit default should throw
      expect(() => container.get(keyWithoutDefault)).toThrow(
        "Can't create an instance of [test] because no value or factory function was supplied",
      );
    });

    test("default values work with different types", () => {
      const container = new Container();

      const numberKey = createKey({ displayName: "num", default: 42 });
      expect(container.get(numberKey)).toBe(42);

      const boolKey = createKey({ displayName: "bool", default: true });
      expect(container.get(boolKey)).toBe(true);

      const objectKey = createKey<{ name: string }>({
        displayName: "obj",
        default: {
          name: "default",
        },
      });
      expect(container.get(objectKey)).toEqual({ name: "default" });

      const arrayKey = createKey<number[]>({
        displayName: "arr",
        default: [1, 2, 3],
      });
      expect(container.get(arrayKey)).toEqual([1, 2, 3]);
    });

    test("explicit null default does not throw", () => {
      const container = new Container();
      const keyWithNullDefault = createKey({
        displayName: "test",
        default: null,
      });

      // Explicit null default should return null, not throw
      const result = container.get(keyWithNullDefault);
      expect(result).toBe(null);
    });

    test("explicit undefined default throws (same as no default)", () => {
      const container = new Container();
      const keyWithUndefinedDefault = createKey({
        displayName: "test",
        default: undefined,
      });

      expect(() => container.get(keyWithUndefinedDefault)).toThrow(
        "Can't create an instance of [test] because no value or factory function was supplied",
      );
    });

    test("inferred type of got value with default does not include null", () => {
      const container = new Container();
      const keyWithDefault = createKey({
        displayName: "test",
        default: "some default",
      });
      const value = container.get(keyWithDefault);
      expectTypeOf(value).toBeString();
    });

    test("inferred type of got value without default does not include null", () => {
      const container = new Container();
      const keyWithoutDefault = createKey<string>({
        displayName: "test",
      });
      container.bind(keyWithoutDefault, { instance: "value" });
      const value = container.get(keyWithoutDefault);
      expectTypeOf(value).toBeString();
    });
  });

  describe("binding checks with defaults", () => {
    test("key with default is not considered bound", () => {
      const container = new Container();
      const keyWithDefault = createKey<string>({
        displayName: "test",
        default: "defaultValue",
      });

      expect(container.bound(keyWithDefault)).toBe(false);

      // After getting with default, still not bound
      container.get(keyWithDefault);
      expect(container.bound(keyWithDefault)).toBe(false);

      // After explicit binding, it is bound
      container.bind(keyWithDefault, { instance: "bound" });
      expect(container.bound(keyWithDefault)).toBe(true);
    });
  });

  describe("optional injection with defaults", () => {
    test("optional inject returns default when available", () => {
      const container = new Container();
      const keyWithDefault = createKey<string>({
        displayName: "optional",
        default: "defaultValue",
      });

      class OptionalInject {
        constructor(public defaultVal = injectOptional(keyWithDefault)) {}
      }

      const instance = container.get(OptionalInject);
      expect(instance.defaultVal).toBe("defaultValue");

      // After binding, returns the bound value
      container.bind(keyWithDefault, { instance: "boundValue" });
      const instance2 = container.get(OptionalInject);
      expect(instance2.defaultVal).toBe("boundValue");
    });
  });
});

// shared dependency class
class Dep implements IDep {
  static instantiations = 0;
  constructor(public name = "default") {
    ++Dep.instantiations;
  }
}

interface IDep {
  get name(): string;
}
const IDep = createKey<IDep>({ displayName: "IDep" });
