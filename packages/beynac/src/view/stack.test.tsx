/** @jsxImportSource ./ */
import { expect, test } from "bun:test";
import { render } from "./markup-stream";
import { Once } from "./once";
import type { Component } from "./public-types";
import { createStack } from "./stack";

test("basic Stack push and out functionality", async () => {
  const MyStack = createStack();

  const result = await render(
    <div>
      <MyStack.Push>First</MyStack.Push>
      <MyStack.Push>Second</MyStack.Push>
      <MyStack.Out />
    </div>,
  );

  expect(result).toBe("<div>FirstSecond</div>");
});

test("StackOut can appear before Stack pushes", async () => {
  const MyStack = createStack();

  const result = await render(
    <div>
      <MyStack.Out />
      <MyStack.Push>After</MyStack.Push>
    </div>,
  );

  expect(result).toBe("<div>After</div>");
});

test("Stack preserves document order with async components", async () => {
  const MyStack = createStack();

  let fastSecondHasRun = false;

  const SlowFirst: Component = async () => {
    await Promise.resolve();
    await Promise.resolve();
    if (!fastSecondHasRun) {
      throw new Error("SlowFirst isn't as slow as expected!");
    }
    return <MyStack.Push>Slow but first</MyStack.Push>;
  };

  const FastSecond: Component = async () => {
    await Promise.resolve();
    fastSecondHasRun = true;
    return <MyStack.Push>Fast but second</MyStack.Push>;
  };

  const result = await render(
    <div>
      <SlowFirst />
      <FastSecond />
      <MyStack.Out />
    </div>,
  );

  expect(result).toBe("<div>Slow but firstFast but second</div>");
});

test("Stack works with Once for deduplication", async () => {
  const MyStack = createStack();
  const StyleOnce = Once.createComponent("style");

  const result = await render(
    <div>
      <MyStack.Push>
        <StyleOnce>First style</StyleOnce>
      </MyStack.Push>
      <MyStack.Push>
        <StyleOnce>Second style</StyleOnce>
      </MyStack.Push>
      <MyStack.Push>Not deduped</MyStack.Push>
      <MyStack.Push>
        <StyleOnce>Third style</StyleOnce>
      </MyStack.Push>
      <MyStack.Push>Also not deduped</MyStack.Push>
      <MyStack.Out />
    </div>,
  );

  expect(result).toBe("<div>First styleNot dedupedAlso not deduped</div>");
});

test("StackOut throws when used twice", async () => {
  const MyStack = createStack();

  expect(
    render(
      <div>
        <MyStack.Out />
        <MyStack.Out />
      </div>,
    ),
  ).rejects.toThrow(/Stack.Out can only be used once per render/);
});

test("multiple independent stacks", async () => {
  const HeadStack = createStack();
  const FooterStack = createStack();

  const result = await render(
    <div>
      <HeadStack.Push>Head 1</HeadStack.Push>
      <FooterStack.Push>Footer 1</FooterStack.Push>
      <HeadStack.Push>Head 2</HeadStack.Push>
      <FooterStack.Push>Footer 2</FooterStack.Push>
      <div class="head">
        <HeadStack.Out />
      </div>
      <div class="footer">
        <FooterStack.Out />
      </div>
    </div>,
  );

  expect(result).toBe(
    '<div><div class="head">Head 1Head 2</div><div class="footer">Footer 1Footer 2</div></div>',
  );
});

test("Stack with complex nested content", async () => {
  const MyStack = createStack();

  const result = await render(
    <div>
      <MyStack.Push>
        <strong>Bold</strong>
        <em>Italic</em>
      </MyStack.Push>
      <MyStack.Out />
    </div>,
  );

  expect(result).toBe("<div><strong>Bold</strong><em>Italic</em></div>");
});

test("Stack with null and undefined content", async () => {
  const MyStack = createStack();

  const result = await render(
    <div>
      <MyStack.Push>{null}</MyStack.Push>
      <MyStack.Push>{undefined}</MyStack.Push>
      <MyStack.Push>{false}</MyStack.Push>
      <MyStack.Push>Visible</MyStack.Push>
      <MyStack.Out />
    </div>,
  );

  expect(result).toBe("<div>Visible</div>");
});

test("Stack preserves order across nested async components", async () => {
  const MyStack = createStack();

  const AsyncOuter: Component = async () => {
    await Promise.resolve();
    return (
      <>
        <AsyncInner />
        <MyStack.Push>From outer</MyStack.Push>
      </>
    );
  };

  const AsyncInner: Component = async () => {
    await Promise.resolve();
    await Promise.resolve();
    return <MyStack.Push>From inner</MyStack.Push>;
  };

  const result = await render(
    <div>
      <AsyncOuter />
      <MyStack.Out />
    </div>,
  );

  expect(result).toBe("<div>From innerFrom outer</div>");
});

test("Stack works with components that use Once inside", async () => {
  const MyStack = createStack();

  const AddStyle: Component<{ id: string }> = ({ id }) => {
    const StyleOnce = Once.createComponent(`style-${id}`);
    return (
      <MyStack.Push>
        <StyleOnce>
          <style>{`#${id} { color: blue; }`}</style>
        </StyleOnce>
      </MyStack.Push>
    );
  };

  const result = await render(
    <div>
      <AddStyle id="header" />
      <AddStyle id="footer" />
      <AddStyle id="header" />
      <MyStack.Out />
      <div id="header">Header</div>
      <div id="footer">Footer</div>
    </div>,
  );

  expect(result).toBe(
    '<div><style>#header { color: blue; }</style><style>#footer { color: blue; }</style><div id="header">Header</div><div id="footer">Footer</div></div>',
  );
});

test("Stack works with Once using number and symbol keys", async () => {
  const MyStack = createStack();
  const symbolKey = Symbol("test");
  const OnceOne = Once.createComponent(1);
  const OnceSymbol = Once.createComponent(symbolKey);
  const OnceTwo = Once.createComponent(2);

  const result = await render(
    <div>
      <MyStack.Push>
        <OnceOne>Number 1</OnceOne>
      </MyStack.Push>
      <MyStack.Push>
        <OnceSymbol>Symbol</OnceSymbol>
      </MyStack.Push>
      <MyStack.Push>
        <OnceOne>Number 1 again</OnceOne>
      </MyStack.Push>
      <MyStack.Push>
        <OnceSymbol>Symbol again</OnceSymbol>
      </MyStack.Push>
      <MyStack.Push>
        <OnceTwo>Number 2</OnceTwo>
      </MyStack.Push>
      <MyStack.Out />
    </div>,
  );

  expect(result).toBe("<div>Number 1SymbolNumber 2</div>");
});

test.skip("Stack push works inside Once", async () => {
  const MyStack = createStack();

  const result = await render(
    <div>
      <Once key="once">
        <MyStack.Push>A</MyStack.Push>
      </Once>
      <Once key="once">
        <MyStack.Push>B</MyStack.Push>
      </Once>
      <MyStack.Out />
    </div>,
  );

  expect(result).toBe("<div>A</div>");
});

test("Once deduplication works across multiple stacks", async () => {
  const StackA = createStack();
  const StackB = createStack();

  const OnceX = Once.createComponent("x");
  const OnceY = Once.createComponent("y");

  const result = await render(
    <div>
      {/* Push X to StackA */}
      <StackA.Push>
        <OnceX>[X1]</OnceX>
      </StackA.Push>
      {/* Push X to StackB - won't render due to Once */}
      <StackB.Push>
        <OnceX>[X2]</OnceX>
      </StackB.Push>
      {/* Push Y to StackB */}
      <StackB.Push>
        <OnceY>[Y1]</OnceY>
      </StackB.Push>
      {/* Push Y to StackA */}
      <StackA.Push>
        <OnceY>[Y2]</OnceY>
      </StackA.Push>
      {/* Push Z to StackB (no Once) */}
      <StackB.Push>[Z]</StackB.Push>
      A:
      <StackA.Out />
      B:
      <StackB.Out />
    </div>,
  );

  // StackA renders: X1 (first OnceX encountered)
  // StackB renders: Y1 (first OnceY encountered), Z
  // X2 is skipped (OnceX already used), Y2 is skipped (OnceY already used)
  expect(result).toBe("<div>A:[X1]B:[Y1][Z]</div>");
});

test("Stack content streams as it becomes available", async () => {
  const MyStack = createStack();

  const DelayedComponent: Component<{ delay: number; text: string }> = async ({ delay, text }) => {
    await new Promise((resolve) => setTimeout(resolve, delay));
    return <MyStack.Push>{text}</MyStack.Push>;
  };

  const result = await render(
    <div>
      <DelayedComponent delay={10} text="First" />
      <DelayedComponent delay={5} text="Second" />
      <MyStack.Out />
    </div>,
  );

  // Despite different delays, order is preserved
  expect(result).toBe("<div>FirstSecond</div>");
});

test("StackOut pushed onto a stack - edge case", async () => {
  const OuterStack = createStack();
  const InnerStack = createStack();

  // Pushing a StackOut component onto another stack
  const result = await render(
    <div>
      <OuterStack.Push>
        <InnerStack.Out />
      </OuterStack.Push>
      <InnerStack.Push>content</InnerStack.Push>
      <OuterStack.Out />
    </div>,
  );

  // The InnerStackOut inside OuterStack will render "content"
  expect(result).toBe("<div>content</div>");
});

test("StackPush pushed onto a stack works correctly", async () => {
  const OuterStack = createStack();
  const InnerStack = createStack();

  // Nested stacks should now work correctly
  const result = await render(
    <div>
      <OuterStack.Push>
        {async () => {
          return <InnerStack.Push>nested content</InnerStack.Push>;
        }}
      </OuterStack.Push>
      <OuterStack.Out />
      <InnerStack.Out />
    </div>,
  );

  // The inner stack content should appear at InnerStack.Out
  // The outer stack should be empty (it contained only a Stack.Push which was processed)
  expect(result).toBe("<div>nested content</div>");
});

test("Stacks maintain independent state and can render concurrently", async () => {
  const Stack = createStack();

  const DelayPush = async ({ delay }: { delay: number }) => {
    for (let i = 0; i < delay; i++) {
      await Promise.resolve();
    }
    return <Stack.Push>{delay}</Stack.Push>;
  };

  const Component = () => (
    <div>
      <Stack.Out />
      <DelayPush delay={1} />
      <DelayPush delay={2} />
      <DelayPush delay={3} />
      <DelayPush delay={4} />
      <DelayPush delay={5} />
    </div>
  );

  const [result1, result2] = await Promise.all([render(<Component />), render(<Component />)]);

  expect(result1).toBe("<div>12345</div>");
  expect(result2).toBe("<div>12345</div>");
});
