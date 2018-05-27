const isRegExp = require('lodash.isregexp')

function caddyPushDirectivePlugin({
  caddyImport = 'push.caddy',
  indexFile = '',
  includePattern = new RegExp('js$|css$|html$'),
  includePaths = [],
  // exclude = /(?!.)/, // TODO: add exclusion regex pattern
}) {
  if (!isRegExp(includePattern)) {
    throw new Error(
      `[caddy-push-plugin] Option 'includePattern' must be a regular expression`
    )
  }
  if (includePaths.length) {
    for (let asset of includePaths) {
      if (!asset.hasOwnProperty('path') || !asset.hasOwnProperty('as')) {
        throw new Error(
          `[caddy-push-plugin] All includePaths assets require 'path' and 'as' properties`
        )
      }
    }
  }
  // if (!isRegExp(exclude)) {
  //   throw new Error(`Option 'exclude' must be a regular expression`)
  // }
  if (!caddyImport.length || typeof caddyImport !== 'string') {
    throw new Error(`[caddy-push-plugin] Option 'caddyImport' must be a string`)
  }

  this.options = { caddyImport, indexFile, includePattern, includePaths }
}

caddyPushDirectivePlugin.prototype.apply = function(compiler) {
  const { options } = this

  return compiler.plugin('emit', function(compilation, callback) {
    const { includePattern, includePaths } = options

    const assets = Object.keys(compilation.assets).filter(asset => {
      return includePattern.test(asset) // && !exclude.test(asset)
    })

    const directive = `header /${options.indexFile} {
  ${linkHeader(assets)}
}

status 404 {
  /${options.caddyImport}
}
`
    compilation.assets[options.caddyImport] = {
      source: () => directive,
      size: () => directive.length,
    }

    return callback(null)

    function assetsLinkHeaderValue(files) {
      const includedPaths = includePaths.map(asset => {
        return `<${asset.path}>; rel=preload; as=${asset.as}`
      })

      return files
        .map(asset => {
          const { crossorigin } = asset
          const preloadAs = fileAs(asset)
          if (!preloadAs) {
            console.warn(`No suitable 'as' attribute match for ${asset}`)
            return null
          }
          let link = `</${asset}>; rel=preload; as=${preloadAs}`
          if (preloadAs === 'font') {
            // fonts MUST be crossorigin=anonymous
            // see https://developer.mozilla.org/en-US/docs/Web/HTML/Preloading_content#Cross-origin_fetches
            link += '; crossorigin=anonymous'
            return link
          }
          if (crossorigin) {
            link += `; crossorigin=${crossorigin}`
          }
          return link
        })
        .filter(Boolean)
        .concat(includedPaths)
        .join(', ')
    }

    function linkHeader(files) {
      return `Link "${assetsLinkHeaderValue(files)}"`
    }

    // TODO: Add more mime types or find package for identifying preload types
    function fileAs(file) {
      const extensions = {
        js: 'script',
        css: 'style',
        woff: 'font',
        woff2: 'font',
        ttf: 'font',
        eot: 'font',
        otf: 'font',
        html: 'document',
        png: 'image',
        jpg: 'image',
        gif: 'image',
        jpeg: 'image',
        json: 'fetch',
        ico: 'icon',
      }
      const ext = file.split('.').pop()
      return extensions[ext]
    }
  })
}

module.exports = caddyPushDirectivePlugin
