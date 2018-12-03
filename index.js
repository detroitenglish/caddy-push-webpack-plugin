const path = require('path')
const minimatch = require('minimatch')

function testRegexOrGlob(val) {
  if (val instanceof RegExp)
    return asset => {
      const base = path.basename(asset)
      const result = val.test(base)
      process.env.DEBUG &&
        console.log(`Testing ${base} with RegExp ${val.toString()}: ${result}`)
      return result
    }
  else if (typeof val === 'string')
    return asset => {
      const base = path.basename(asset)
      const result = minimatch(base, val)
      process.env.DEBUG &&
        console.log(`Testing ${base} with glob '${val}': ${result}`)
      return result
    }
  else {
    console.warn(
      `[caddy-push-plugin] Patterns must be RegExp or strings!`,
      `(got ${JSON.stringify(val)} as ${typeof val})`
    )
    return () => {}
  }
}

function caddyPushDirectivePlugin({
  caddyImportFile = 'push.caddy',
  headerPath = '/',
  includePatterns = [/\.(html|css|js)(\?.*)?$/],
  ignorePatterns = [],
  prefetchPatterns = [],
  includeFiles = [],
  allAnonymous = false,
}) {
  if (!Array.isArray(includePatterns)) {
    includePatterns = [includePatterns]
  }
  if (!Array.isArray(ignorePatterns)) {
    ignorePatterns = [ignorePatterns]
  }
  if (!Array.isArray(prefetchPatterns)) {
    prefetchPatterns = [prefetchPatterns]
  }
  if (includeFiles.length) {
    for (let asset of includeFiles) {
      if (typeof asset !== `object` || !('hasOwnProperty' in asset)) {
        throw new Error(
          `[caddy-push-plugin] All 'includePaths' entries must be plain objects`
        )
      }
      if (!asset.hasOwnProperty('path')) {
        throw new Error(
          `[caddy-push-plugin] All includeFiles assets require 'path' property`
        )
      }
    }
  }
  if (headerPath[0] !== '/') {
    throw new Error(`[caddy-push-plugin] headerPath MUST begin with '/'`)
  }

  if (!caddyImportFile.length || typeof caddyImportFile !== 'string') {
    throw new Error(`[caddy-push-plugin] Option 'caddyImport' must be a string`)
  }

  this.options = {
    caddyImportFile,
    headerPath,
    includePatterns: includePatterns.map(testRegexOrGlob),
    ignorePatterns: ignorePatterns.map(testRegexOrGlob),
    prefetchPatterns: prefetchPatterns.map(testRegexOrGlob),
    includeFiles,
    allAnonymous,
  }
}

caddyPushDirectivePlugin.prototype.apply = function(compiler) {
  const { options } = this
  return compiler.plugin('emit', function(compilation, callback) {
    const {
      includePatterns,
      ignorePatterns,
      prefetchPatterns,
      includeFiles,
      allAnonymous,
    } = options

    const assets = Object.keys(compilation.assets).filter(file => {
      return (
        includePatterns.some(test => test(file)) &&
        (!ignorePatterns.length || ignorePatterns.every(test => !test(file)))
      )
    })
    !!process.env.DEBUG && console.log(JSON.stringify({ assets }, null, 1))
    const directive = [
      `header ${options.headerPath} {`,
      `  ${assetsLinkHeaderValue(assets)}`,
      `}`,
      '',
      `status 404 /${options.caddyImportFile}`,
    ].join('\n')

    compilation.assets[options.caddyImportFile] = {
      source: () => directive,
      size: () => directive.length,
    }

    return callback(null)

    function assetsLinkHeaderValue(files) {
      let preloads = []
      let otherHints = []
      includeFiles.forEach(asset => {
        const {
          type,
          nopush = false,
          crossorigin,
          path,
          as: loadAs,
          rel = 'preload',
        } = asset
        let link = `<${path}>; rel=${rel}`
        if (type) link += `; type=${type}`
        if (loadAs) link += `; as=${loadAs}`
        if (nopush) link += `; nopush`
        // fonts MUST be crossorigin=anonymous !
        if (loadAs === 'font' || crossorigin || !!allAnonymous) {
          link += '; crossorigin=anonymous'
        }
        return rel === 'preload' ? preloads.push(link) : otherHints.push(link)
      })

      files
        .filter(asset => !includeFiles.find(file => asset.includes(file.path))) // override patterns with manual includes
        .forEach(asset => {
          const isPrefetch =
            prefetchPatterns.length &&
            prefetchPatterns.some(test => test(asset))
          const preloadAs = isPrefetch ? null : fileAs(asset)
          if (!isPrefetch && !preloadAs) {
            console.warn(
              `No suitable 'as' attribute match for ${asset}, exluding from`,
              `the link header directive. Use the 'includeFiles' option to`,
              `manually include your asset with a corresponding 'as' attribute.`
            )
            return
          }
          let link = `</${asset}>; rel=${isPrefetch ? 'prefetch' : 'preload'}`
          if (!isPrefetch) link += `; as=${preloadAs}`
          if (preloadAs === 'font' || !!allAnonymous) {
            link += '; crossorigin=anonymous'
          } else if (path.extname(asset) === '.ico') {
            link += '; type=image/x-icon'
          }
          return isPrefetch ? otherHints.push(link) : preloads.push(link)
        })

      preloads = `+Link "${preloads.join(', ')}"`
      otherHints = `+Link "${otherHints.join(', ')}"`
      return [preloads, otherHints].join('\n  ')
    }

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
        xml: 'document',
        png: 'image',
        jpg: 'image',
        gif: 'image',
        svg: 'image',
        jpeg: 'image',
        json: 'fetch',
        ico: 'image',
        manifest: 'manifest',
      }

      let ext

      if (path.basename(file).includes('manifest.json')) {
        ext = 'manifest'
      } else ext = path.extname(file).replace(/\./, '')

      return extensions[ext]
    }
  })
}

module.exports = caddyPushDirectivePlugin
