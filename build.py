import re, json
src = 'src/'
rd = lambda f: open(src + f).read()
html = rd('index.html')
mqcss = open('test/node_modules/mathquill/build/mathquill.css').read()
mqcss = re.sub(r'@font-face\s*\{[^}]*\}', '', mqcss)
mqcss = re.sub(r'/\*.*?\*/', '', mqcss, flags=re.S)
mqcss = re.sub(r'\s+', ' ', mqcss)
html = html.replace('/*@@MQCSS@@*/', mqcss)
html = html.replace('/*@@I18N@@*/', rd('i18n.js'))
eng = rd('engine.js').replace("if (typeof module !== 'undefined') module.exports = K;", '')
html = html.replace('/*@@ENGINE@@*/', eng)
html = html.replace('/*@@EDITOR@@*/', rd('editor.js').replace("if (typeof module !== 'undefined') module.exports = ED;", ''))
html = html.replace('/*@@LOGOS@@*/', rd('logos.js'))
html = html.replace('/*@@GLOSS@@*/', rd('glossary.js'))
html = html.replace('/*@@UI@@*/', rd('extras.js') + '\n' + rd('ui.js'))
ver = re.search(r"APP_VERSION = '([\d.]+)'", html).group(1)
open('dist/index.html', 'w').write(html)
json.dump({'version': ver}, open('dist/version.json', 'w'))
loc = html
for a, b in [('https://code.jquery.com/jquery-3.7.1.min.js', 'node_modules/jquery/dist/jquery.min.js'),
             ('https://cdn.jsdelivr.net/npm/mathquill@0.10.1/build/mathquill.min.js', 'node_modules/mathquill/build/mathquill.min.js'),
             ('https://cdn.jsdelivr.net/npm/mathjs@12.4.2/lib/browser/math.js', 'node_modules/mathjs/lib/browser/math.js'),
             ('https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js', 'node_modules/mathjax/es5/tex-svg.js')]:
    loc = loc.replace(a, b)
loc = loc.replace('https://cdn.jsdelivr.net/npm/nerdamer@1.1.13/', 'node_modules/nerdamer/')
open('test/local.html', 'w').write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + loc + '</body></html>')
json.dump({'version': ver}, open('test/version.json', 'w'))

# GitHub Pages: vollständiges HTML-Dokument (dist/pages/)
import os
os.makedirs('dist/pages', exist_ok=True)
cut = html.index('<style')
page = ('<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">\n'
        '<meta name="description" content="CAS-Rechner im Browser mit Rechenweg: Gleichungen, Ableitungen, Integrale, Matrizen, Graphen, DGL und mehr.">\n'
        + html[:cut] + '\n</head>\n<body>\n' + html[cut:] + '\n</body>\n</html>\n')
open('dist/pages/index.html', 'w').write(page)
json.dump({'version': ver}, open('dist/pages/version.json', 'w'))
print(len(html) // 1024, 'KB, version', ver)
