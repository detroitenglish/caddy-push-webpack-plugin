# caddy-push-webpack-plugin
Generate a [Caddy server header directive](https://caddyserver.com/docs/header) with Link preloads for for effortless leveraging of Caddy's link header detection for http2 server push.

**WARNING**: There could very well be serious security issues in deploying this technique that I am not clever enough to recognize. Use at your own risk!

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
* `includePatterns`: Array of regular expressions for assets to be included in the `Link` header as `rel=preload` and pushed to the client (default: `[/\.(html|css|js)(\?.*)?$/]` );
* `includeFiles`: Array (default: `[]` ) of objects for manually defining custom Link preload entries. Each included object supports the following properties:

````javascript
{
  path: `/path/to/your/asset`, // required, no default
  as: `waffle`, // required, no default
  crossorigin: `anonymous`, // optional CORS attribute, no default
  type: `application/javascript`, // option type attribute, no default
  nopush: false, // boolean; optional directive instructing clients to preload, but prevent server push; default false
}
````
See [the MDN documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Preloading_content#What_types_of_content_can_be_preloaded) for a list of acceptable 'as' attribute values


## Example

Assuming webpack produces the following assets:
````
- static/js/app.js
- static/css/style.css
- static/font/superCoolFont.woff
- favicon.ico
- index.html
````

The following plugin config:

````javascript
new caddyPushPlugin({
  caddyImportFile: `foo-directive.caddy`,
  headerPath: `/login`,
  includePatterns: /\.(css|js|ico)$/,
  includeFiles: [
    {
      path: `/static/font/superCoolFont.woff`,
      as: `font`,
      crossorigin: `anonymous`,
      nopush: true,
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
````
header /login {
  Link "</static/js/app.js>; rel=preload; as=script, </static/js/app.js>; rel=preload; as=script, </static/css/style.css>; rel=preload; as=style, </favicon.ico>; rel=preload; as=icon, <//some-cdn.example/superCoolFont.css>; rel=preload; as=style; crossorigin=anonymous; nopush;"
}

# Auto-generated for security reasons
status 404 /foo-directive.caddy
````

...which you then import in your Caddyfile:
````
super-cool-app.example {

  # ... Caddyfile config stuff

  # don't forget the push directive!
  push

  import "/absolute/path/to/app/foo-directive.caddy"

  # ... rest of your Caddyfile

}
````

## Caveats

### Cache awareness
If you use the default headerPath ( `/` ),  Caddy is going to push *every* asset in your generated `Link` header for *every* resource request to your site domain. You probably do not want this, and must disable this behavior on a per-asset and/or per-directory basis like so:

````go
header /static -Link
header /login/_session -Link
header /other/example/path/lol.jpg -Link
````

### Exluding assets
If you would like to exclude a particular asset for whatever reason, add a negative lookahead regular expression construct to the `includePatterns` array e.g. `/^(?!dont-push-me\.js)/`

### Server restart
After uploading your generated files to your server, you'll need to restart your Caddy instance in order for any changes to take effect.


## Todos

- [ ] Confer with Caddy devs about possible security issues
- [ ] Learn to write tests, and write tests!
- [ ] Add support asset file globbing
- [ ] ~~Add support for `excludePattern` regex + globs~~ Use use a negative lookahead...