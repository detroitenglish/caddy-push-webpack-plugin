const isRegExp = require('lodash.isregexp')
const isPlainObject = require('lodash.isplainobject')
function caddyPushDirectivePlugin({
  caddyImportFile = 'push.caddy',
  headerPath = '/',
  includePatterns = [/\.(html|css|js)(\?.*)?$/],
  includeFiles = [],
  // exclude = /(?!.)/, // TODO: add exclusion regex pattern
}) {
  if (!Array.isArray(includePatterns) && isRegExp(includePatterns)) {
    includePatterns = [includePatterns]
  }

  if (!includePatterns.every(isRegExp)) {
    throw new Error(
      `[caddy-push-plugin] All 'includePatterns' entries must be regular expressions`
    )
  }
  if (includeFiles.length) {
    for (let asset of includeFiles) {
      if (!isPlainObject(asset)) {
        throw new Error(
          `[caddy-push-plugin] All 'includePaths' entries must be objects`
        )
      }
      if (!asset.hasOwnProperty('path') || !asset.hasOwnProperty('as')) {
        throw new Error(
          `[caddy-push-plugin] All includeFiles assets require 'path' and 'as' properties`
        )
      }
    }
  }
  if (headerPath[0] !== '/') {
    throw new Error(`[caddy-push-plugin] headerPath MUST begin with '/'`)
  }
  // if (!isRegExp(exclude)) {
  //   throw new Error(`Option 'exclude' must be a regular expression`)
  // }
  if (!caddyImportFile.length || typeof caddyImportFile !== 'string') {
    throw new Error(`[caddy-push-plugin] Option 'caddyImport' must be a string`)
  }

  this.options = { caddyImportFile, headerPath, includePatterns, includeFiles }
}

caddyPushDirectivePlugin.prototype.apply = function(compiler) {
  const { options } = this

  return compiler.plugin('emit', function(compilation, callback) {
    const { includePatterns, includeFiles } = options

    const assets = Object.keys(compilation.assets).filter(asset => {
      return includePatterns.every(pattern => pattern.test(asset)) // && !exclude.test(asset)
    })

    const directive = `
header ${options.headerPath} {
  ${linkHeader(assets)}
}

status 404 /${options.caddyImportFile}
`
    compilation.assets[options.caddyImportFile] = {
      source: () => directive,
      size: () => directive.length,
    }

    return callback(null)

    function assetsLinkHeaderValue(files) {
      const includedPaths = includeFiles.map(asset => {
        const { type, nopush = false, crossorigin, path, as: loadAs } = asset
        let link = `<${path}>; rel=preload; as=${loadAs}`
        if (type) link += `; type=${type}`
        if (!!nopush === true) link += `; nopush`
        if (loadAs === 'font') {
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

      return files
        .filter(asset => !includeFiles.find(file => file.path === asset)) // override patterns with manual includes
        .map(asset => {
          const preloadAs = fileAs(asset)
          if (!preloadAs) {
            console.warn(
              `No suitable 'as' attribute match for ${asset} - excluding!`
            )
            return null
          }
          let link = `</${asset}>; rel=preload; as=${preloadAs}`
          if (preloadAs === 'font') {
            // fonts MUST be crossorigin=anonymous
            // see https://developer.mozilla.org/en-US/docs/Web/HTML/Preloading_content#Cross-origin_fetches
            link += '; crossorigin=anonymous'
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
        mjs: 'script',
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
