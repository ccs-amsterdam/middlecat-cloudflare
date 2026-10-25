import type { Child } from "hono/jsx";
import { raw } from "hono/html";

export function Layout({ title, scripts, children }: { title?: string; scripts?: string[]; children: Child }) {
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="description" content="cat-in-the-middle authentication" />
          <title>{title ? `${title} - MiddleCat` : "MiddleCat"}</title>
          <link rel="icon" href="/favicon.ico" />
          <link rel="stylesheet" href="/globals.css" />
          <link rel="stylesheet" href="/components.css" />
          {(scripts || []).map((src) => (
            <script src={src} defer></script>
          ))}
        </head>
        <body>
          <Header />
          {children}
          <footer class="Footer">
            <a href="/privacy">Privacy</a>
          </footer>
        </body>
      </html>
    </>
  );
}

export function Header() {
  return (
    <header class="Header">
      <div>
        <h2>MiddleCat</h2>
        <h4>cat-in-the-middle authentication</h4>
      </div>
    </header>
  );
}

export function Loading({ msg }: { msg?: string }) {
  return (
    <div class="LoadingContainer">
      <span class="spike-loader"></span>
      <h2>{msg || ""}</h2>
    </div>
  );
}

export function ErrorMsg({ type, children }: { type?: string; children?: Child }) {
  return (
    <div class="ErrorMsg">
      {type ? <h2 class="ErrorType">{type}</h2> : null}
      <h3>{children}</h3>
    </div>
  );
}
