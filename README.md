# caddy-push-webpack-plugin
Generate a [Caddy server header directive](https://caddyserver.com/docs/header) with Link preloads for for effortless leveraging of Caddy's link header detection for http2 server push.

**WARNING**: There could very well be serious security issues in deploying this technique that I am not clever enough to recognize. **I THEREFORE DO NOT RECOMMEND USING THIS IN PRODUCTION**. Unless you like to live dangerously, in which case, use at your own risk!

NOTE: You **must** import the generatated file in your Caddyfile using Caddy's `import` directive, and then restart your Caddy instance in order for the changes to take effect.


## Usage

Require the plugin...

````javascript
const caddyPushPlugin = require('caddy-push-webpack-plugin');
````

Include the plugin in your webpack config...

````javascript
// ...webpack config

plugins: [
  new caddyPushPlugin(),
],

// ...more webpack config
````

## Configuration

The config object supports the following options:

* `caddyImportFile`: filepath relative to your webpack `output` directory which you will import into your Caddyfile (default: `push.caddy` );
* `headerPath`: path **beginning with '/'** to which Caddy will add the `Link` header (default: `'/'` );
* `includePattern`: Regular expression definining which assets will be included in the `Link` header as `rel=preload` and pushed to the client (default: `/\.(js|css|html)$/` );
* `includePaths`: Array of objects for including custom `rel=preload` entries. Each included path object supports the following attributes:
````javascript
{
  path: `/path/to/your/asset`, // required
  as: `sometype`, // required - See https://developer.mozilla.org/en-US/docs/Web/HTML/Preloading_content#What_types_of_content_can_be_preloaded
  crossorigin: ``, // optional CORS attribute, no default
}
````

## Example

Assuming webpack produces the following assets:
````
- static/js/app.js
- static/css/style.css
- static/img/dancing-waffle.gif
- favicon.ico
- index.html
````

The following plugin config:

````javascript
new caddyPushPlugin({
  caddyImportFile: `foo-directive.caddy`,
  headerPath: `/login`,
  includePattern: /\.(css|js|ico)$/,
  includePaths: [
    {
      path: `/login/_session`,
      as: `fetch`,
      crossorigin: `use-credentials`,
    }
  ],
}),
````

...will add an additional file to your assets:
````bash
- static/js/app.js
- static/css/style.css
- static/img/dancing-waffle.gif
- favicon.ico
- index.html
- foo-directive.caddy # <-- this
````

...which will look like so:
````go
header /login {
  Link "</static/js/app.js>; rel=preload; as=script, </static/js/app.js>; rel=preload; as=script, </static/css/style.css>; rel=preload; as=style, </favicon.ico>; rel=preload; as=icon, </login/_session>; rel=preload; as=fetch; crossorigin=use-credentials;"
}

// This is auto-generated because of obvious security implications
status 404 /foo-directive.caddy
````

...which you then import in your Caddyfile:
````go
super-cool-app.example {

  // ... Caddyfile config stuff

  // and don't forget this ;)
  push

  import "/absolute/path/to/app/foo-directive.caddy"

  // ... rest of your Caddyfile

}
````

## Caveats

### Cache awareness
If you use the default headerPath (`/`), then Caddy is going to push *every* asset in your generated `Link` header for *every* request to your site. You probably do not want this, and must disable this behavior on a per-asset and/or per-directory basis like so:

````go
header /static -Link
header /login -Link
header /other/example/path/lol -Link
````

### Server restart
After uploading your generated files to your server, you'll need to restart your Caddy instance in order for any changes to take effect.


## Todos

- [ ] Confer with Caddy devs about possible security issues
- [ ] Learn to write tests, and write tests!
- [ ] Add support asset file globbing
- [ ] Add support for `excludePattern` regex + globs