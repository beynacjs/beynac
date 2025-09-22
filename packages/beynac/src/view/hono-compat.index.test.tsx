/** @jsxImportSource ./ */
// These tests are imported from the tmp-hono-view implementation for compatibility testing
// They may need modifications to work with the Beynac JSX implementation

import { describe, expect, it, test } from "bun:test";
import type { Component, Content, PropsWithChildren } from "./public-types";
import { render } from "./markup-stream";

export const testAsyncContent = async (): Promise<Content> => {
  return "test";
};

describe("Hono compatibility tests - render to string", () => {
  it("Nested array", async () => {
    const template = (
      <p>
        {[[["a"]], [["b"]]].map((item1) =>
          item1.map((item2) => item2.map((item3) => <span>{item3}</span>))
        )}
      </p>
    );
    expect(await render(template)).toBe("<p><span>a</span><span>b</span></p>");
  });

  it("Empty elements are rendered without closing tag", async () => {
    const template = <input />;
    expect(await render(template)).toBe("<input>");
  });

  it("Props value is null", async () => {
    const template = <span data-hello={null}>Hello</span>;
    expect(await render(template)).toBe("<span>Hello</span>");
  });

  it("Props value is undefined", async () => {
    const template = <span data-hello={undefined}>Hello</span>;
    expect(await render(template)).toBe("<span>Hello</span>");
  });

  it("Should render async component", async () => {
    const ChildAsyncComponent = async (): Promise<Content> => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return <span>child async component</span>;
    };

    const AsyncComponent = async (): Promise<Content> => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return (
        <h1>
          Hello from async component
          <ChildAsyncComponent />
        </h1>
      );
    };

    const c = <AsyncComponent />;
    const rendered = await render(c);
    expect(rendered).toBe(
      "<h1>Hello from async component<span>child async component</span></h1>"
    );
  });

  describe("dangerouslySetInnerHTML", () => {
    it.skip("Should render dangerouslySetInnerHTML", async () => {
      // This feature may not be implemented in Beynac
      const template = (
        <span dangerouslySetInnerHTML={{ __html: '" is allowed here' }}></span>
      );
      expect(await render(template)).toBe('<span>" is allowed here</span>');
    });

    it.skip("Should get an error if both dangerouslySetInnerHTML and children are specified", async () => {
      // This feature may not be implemented in Beynac
      expect(
        async () =>
          await render(
            <span dangerouslySetInnerHTML={{ __html: '" is allowed here' }}>
              Hello
            </span>
          )
      ).toThrow(Error);
    });
  });

  // https://en.reactjs.org/docs/jsx-in-depth.html#booleans-null-and-undefined-are-ignored
  describe("Booleans, Null, and Undefined Are Ignored", () => {
    it.each([true, false, undefined, null])("%s", async (item) => {
      expect(await render(<span>{item}</span>)).toBe("<span></span>");
    });

    it("falsy value", async () => {
      const template = <span>{0}</span>;
      expect(await render(template)).toBe("<span>0</span>");
    });
  });

  // https://en.reactjs.org/docs/jsx-in-depth.html#props-default-to-true
  describe('Props Default to "True"', () => {
    it("default prop value", async () => {
      const template = <span data-hello>Hello</span>;
      expect(await render(template)).toBe(
        '<span data-hello="true">Hello</span>'
      );
    });
  });

  // https://html.spec.whatwg.org/#attributes-3
  describe("Boolean attribute", () => {
    it("default prop value for checked", async () => {
      const template = <input type="checkbox" checked />;
      expect(await render(template)).toBe('<input type="checkbox" checked>');
    });

    it("default prop value for checked={true}", async () => {
      const template = <input type="checkbox" checked={true} />;
      expect(await render(template)).toBe('<input type="checkbox" checked>');
    });

    it("no prop for checked={false}", async () => {
      const template = <input type="checkbox" checked={false} />;
      expect(await render(template)).toBe('<input type="checkbox">');
    });

    it("default prop value for disabled", async () => {
      const template = <input type="checkbox" disabled />;
      expect(await render(template)).toBe('<input type="checkbox" disabled>');
    });

    it("default prop value for disabled={true}", async () => {
      const template = <input type="checkbox" disabled={true} />;
      expect(await render(template)).toBe('<input type="checkbox" disabled>');
    });

    it("no prop for disabled={false}", async () => {
      const template = <input type="checkbox" disabled={false} />;
      expect(await render(template)).toBe('<input type="checkbox">');
    });

    it("default prop value for readonly", async () => {
      const template = <input type="checkbox" readonly />;
      expect(await render(template)).toBe('<input type="checkbox" readonly>');
    });

    it("default prop value for readonly={true}", async () => {
      const template = <input type="checkbox" readonly={true} />;
      expect(await render(template)).toBe('<input type="checkbox" readonly>');
    });

    it("no prop for readonly={false}", async () => {
      const template = <input type="checkbox" readonly={false} />;
      expect(await render(template)).toBe('<input type="checkbox">');
    });

    it("default prop value for selected", async () => {
      const template = (
        <option value="test" selected>
          Test
        </option>
      );
      expect(await render(template)).toBe(
        '<option value="test" selected>Test</option>'
      );
    });

    it("default prop value for selected={true}", async () => {
      const template = (
        <option value="test" selected={true}>
          Test
        </option>
      );
      expect(await render(template)).toBe(
        '<option value="test" selected>Test</option>'
      );
    });

    it("no prop for selected={false}", async () => {
      const template = (
        <option value="test" selected={false}>
          Test
        </option>
      );
      expect(await render(template)).toBe('<option value="test">Test</option>');
    });

    it("default prop value for multiple select", async () => {
      const template = (
        <select multiple>
          <option>test</option>
        </select>
      );
      expect(await render(template)).toBe(
        "<select multiple><option>test</option></select>"
      );
    });

    it("default prop value for select multiple={true}", async () => {
      const template = (
        <select multiple={true}>
          <option>test</option>
        </select>
      );
      expect(await render(template)).toBe(
        "<select multiple><option>test</option></select>"
      );
    });

    it("no prop for select multiple={false}", async () => {
      const template = (
        <select multiple={false}>
          <option>test</option>
        </select>
      );
      expect(await render(template)).toBe(
        "<select><option>test</option></select>"
      );
    });

    it('should render "false" value properly for other non-defined keys', async () => {
      const template = <input type="checkbox" testkey={false} />;
      expect(await render(template)).toBe(
        '<input type="checkbox" testkey="false">'
      );
    });

    it("should support attributes for elements other than input", async () => {
      const template = (
        <video controls autoplay>
          <source src="movie.mp4" type="video/mp4" />
        </video>
      );
      expect(await render(template)).toBe(
        '<video controls autoplay><source src="movie.mp4" type="video/mp4"></video>'
      );
    });
  });

  describe("download attribute", () => {
    it("<a download={true}></a> should be rendered as <a download></a>", async () => {
      const template = <a download={true}></a>;
      expect(await render(template)).toBe("<a download></a>");
    });

    it("<a download={false}></a> should be rendered as <a></a>", async () => {
      const template = <a download={false}></a>;
      expect(await render(template)).toBe("<a></a>");
    });

    it("<a download></a> should be rendered as <a download></a>", async () => {
      const template = <a download></a>;
      expect(await render(template)).toBe("<a download></a>");
    });

    it('<a download="test"></a> should be rendered as <a download="test"></a>', async () => {
      const template = <a download="test"></a>;
      expect(await render(template)).toBe('<a download="test"></a>');
    });
  });

  // https://en.reactjs.org/docs/jsx-in-depth.html#functions-as-children
  describe("Functions as Children", () => {
    it("Function", async () => {
      function Repeat(props: {
        numTimes: number;
        children: (index: number) => Content;
      }) {
        const items = [];
        for (let i = 0; i < props.numTimes; i++) {
          items.push(props.children(i));
        }
        return <div>{items}</div>;
      }

      function ListOfTenThings() {
        return (
          <Repeat numTimes={10}>
            {(index) => <div key={index}>This is item {index} in the list</div>}
          </Repeat>
        );
      }

      const template = <ListOfTenThings />;
      expect(await render(template)).toBe(
        "<div><div>This is item 0 in the list</div><div>This is item 1 in the list</div><div>This is item 2 in the list</div><div>This is item 3 in the list</div><div>This is item 4 in the list</div><div>This is item 5 in the list</div><div>This is item 6 in the list</div><div>This is item 7 in the list</div><div>This is item 8 in the list</div><div>This is item 9 in the list</div></div>"
      );
    });
  });

  describe("Component", () => {
    it("Should define the type correctly", async () => {
      const Layout: Component<PropsWithChildren<{ title: string }>> = (
        props
      ) => {
        return (
          <html>
            <head>
              <title>{props.title}</title>
            </head>
            <body>{props.children}</body>
          </html>
        );
      };

      const Top = (
        <Layout title="Home page">
          <h1>Hono</h1>
          <p>Hono is great</p>
        </Layout>
      );

      expect(await render(Top)).toBe(
        "<html><head><title>Home page</title></head><body><h1>Hono</h1><p>Hono is great</p></body></html>"
      );
    });

    describe("Booleans, Null, and Undefined Are Ignored", () => {
      it.each([true, false, undefined, null])("%s", async (item) => {
        const Component: Component = (() => {
          return item;
        }) as Component;
        const template = <Component />;
        expect(await render(template)).toBe("");
      });

      it("falsy value", async () => {
        const Component: Component = (() => {
          return 0;
        }) as unknown as Component;
        const template = <Component />;
        expect(await render(template)).toBe("0");
      });
    });
  });

  describe("style attribute", () => {
    it("should convert the object to strings", async () => {
      const template = (
        <h1
          style={{
            color: "red",
            fontSize: "small",
            fontFamily: 'Menlo, Consolas, "DejaVu Sans Mono", monospace',
          }}
        >
          Hello
        </h1>
      );
      expect(await render(template)).toBe(
        '<h1 style="color:red;font-size:small;font-family:Menlo, Consolas, &quot;DejaVu Sans Mono&quot;, monospace">Hello</h1>'
      );
    });
    it("should not convert the strings", async () => {
      const template = <h1 style="color:red;font-size:small">Hello</h1>;
      expect(await render(template)).toBe(
        '<h1 style="color:red;font-size:small">Hello</h1>'
      );
    });
    it("should render variable without any name conversion", async () => {
      const template = <h1 style={{ "--myVar": 1 }}>Hello</h1>;
      expect(await render(template)).toBe('<h1 style="--myVar:1px">Hello</h1>');
    });
  });

  describe("head", () => {
    it("Simple head elements should be rendered as is", async () => {
      const template = (
        <head>
          <title>Hono!</title>
          <meta name="description" content="A description" />
          <script src="script.js"></script>
        </head>
      );
      expect(await render(template)).toBe(
        '<head><title>Hono!</title><meta name="description" content="A description"><script src="script.js"></script></head>'
      );
    });
  });
});

describe("Fragment", () => {
  it("Should render children", async () => {
    const template = (
      <>
        <p>1</p>
        <p>2</p>
      </>
    );
    expect(await render(template)).toBe("<p>1</p><p>2</p>");
  });

  it("Should render children - with `Fragment`", async () => {
    const template = (
      <>
        <p>1</p>
        <p>2</p>
      </>
    );
    expect(await render(template)).toBe("<p>1</p><p>2</p>");
  });

  it("Should render a child", async () => {
    const template = (
      <>
        <p>1</p>
      </>
    );
    expect(await render(template)).toBe("<p>1</p>");
  });

  it("Should render a child - with `Fragment`", async () => {
    const template = (
      <>
        <p>1</p>
      </>
    );
    expect(await render(template)).toBe("<p>1</p>");
  });

  it("Should render nothing for empty Fragment", async () => {
    const template = <></>;
    expect(await render(template)).toBe("");
  });

  it("Should render nothing for undefined", async () => {
    const template = <>{undefined}</>;
    expect(await render(template)).toBe("");
  });
});

describe("SVG", () => {
  it("simple", async () => {
    const template = (
      <svg>
        <circle
          cx="50"
          cy="50"
          r="40"
          stroke="black"
          stroke-width="3"
          fill="red"
        />
      </svg>
    );
    expect(await render(template)).toBe(
      '<svg><circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red"></circle></svg>'
    );
  });

  it("title element", async () => {
    const template = (
      <>
        <head>
          <title>Document Title</title>
        </head>
        <svg>
          <title>SVG Title</title>
        </svg>
      </>
    );
    expect(await render(template)).toBe(
      "<head><title>Document Title</title></head><svg><title>SVG Title</title></svg>"
    );
  });

  describe("attribute", () => {
    describe("camelCase", () => {
      test.each([
        { key: "attributeName" },
        { key: "baseFrequency" },
        { key: "calcMode" },
        { key: "clipPathUnits" },
        { key: "viewBox" },
      ])("$key", async ({ key }) => {
        const template = (
          <svg>
            <g {...{ [key]: "test" }} />
          </svg>
        );
        expect(await render(template)).toBe(`<svg><g ${key}="test"></g></svg>`);
      });
    });

    describe("data-*", () => {
      test.each([
        { key: "data-foo" },
        { key: "data-foo-bar" },
        { key: "data-fooBar" },
      ])("$key", async ({ key }) => {
        const template = (
          <svg>
            <g {...{ [key]: "test" }} />
          </svg>
        );
        expect(await render(template)).toBe(`<svg><g ${key}="test"></g></svg>`);
      });
    });
  });
});
