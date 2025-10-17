/** @jsxImportSource beynac/view **/
import { Controller } from "beynac";
import { Cookies, Headers } from "beynac/facades";
import { Component, PropsWithChildren, renderResponse } from "beynac/view";

export class IndexController implements Controller {
  handle() {
    return renderResponse(<IndexView />);
  }
}

const IndexView = () => (
  <Layout>
    <h2>Request data:</h2>
    <h3>
      <code>Cookies</code> facade
    </h3>
    {Cookies.size === 0 ? (
      <p>
        <i>No cookies</i>
      </p>
    ) : (
      <ul>
        {Cookies.entries().map(([name, value]) => (
          <li>
            {name}: {value}
          </li>
        ))}
      </ul>
    )}
    <h3>
      <code>Headers</code> facade
    </h3>
    {Headers.size === 0 ? (
      <p>
        <i>No headers</i>
      </p>
    ) : (
      <ul>
        {Headers.entries().map(([name, value]) => (
          <li>
            {name}: {value}
          </li>
        ))}
      </ul>
    )}
  </Layout>
);

const Layout: Component<PropsWithChildren> = ({ children }) => (
  <html>
    <head>
      <title>Beynac Test App</title>
    </head>
    <body>
      <h1>Beynac Test App</h1>
      {children}
    </body>
  </html>
);
