
// wrecked-no-grab=true

(function() {

    let fileMap = null;
    let currentPath = null;
    let scripts = [];
    let sourceMaps = {};
    
    const showErrorsOnScreen = false;
    const applySourceMaps = false;
    
    const dataURIRegex = /data:([a-zA-Z0-9!#$&.+-^_]+\/[a-zA-Z0-9!#$&.+-^_]+)?(;[a-zA-Z0-9!#$&.+-^_]+)*;base64,([A-Za-z0-9+/]+={0,2})/g;
    const importRegex = /^(?:(import(?:\s+\*\s+as\s+\w+|\s+\w+|\s*\{[^}]*\})\s+from\s+)["']([^"']+)["'];?)(?:\s*)(?!\/\/\s*wrecked-no-grab=true)\n/mg;
    const schemeRegex = /^[a-z][a-z\d+\-.]*:/;
    const sourceMapRegex = /\/\/# sourceMappingURL=([^\n]*)(\n|$)/;
    const lineAndColnoRegex = /:(\d+):(\d+)/;
    const pathSep = /(?<!\\)\//;
    const extTypes = {
        '.js': 'javascript',
        '.ts': 'typescript',
    };
    const vlqAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    
    function applySourceMap(line, map, path) {
        const after = line.slice(line.indexOf(path) + path.length + 1);
        const match = lineAndColnoRegex.exec(after);
        if (match) {
            const [lineno, colno] = match.slice(1);
            let sections = map.mappings.split(';');
            sections = sections[lineno - 2].split(',');
            alert(sections);
            sections = sections.map((section) => {
                let newSection = [];
                let value = 0;
                let contCount = 0;
                for (const x of section.split('').map((y) => vlqAlphabet.indexOf(y))) {
                    value += (x & 30) >> (4*contCount + 1);
                    if (contCount == 0 && (x & 1)) value = -value;
                    if (x & 32 == 32) {
                        contCount += 1;
                    } else {
                        newSection.push(value);
                        value = 0;
                    }
                    if (section == 'AAEvB') alert(value + '\n' + contCount + '\n' + JSON.stringify(newSection));
                }
                return newSection;
            });
            alert(JSON.stringify(sections));
            const newLineno = lineno;
            const newColno = colno;
            line = line.replace(match[0], ':' + newLineno + ':' + newColno);
        }
        return line;
    }
    
    function handleError(error, applyMaps=applySourceMaps) {
        if (error.wreckedNoGrab) return;
        let msg = error.stack ? error.stack : error.message;
        msg = msg.split('\n');
        for (let i = 0; i < msg.length; i++) {
            let line = msg[i];
            let path = null;
            const matches = line.matchAll(dataURIRegex);
            for (const match of matches) {
                const code = atob(match[3]);
                if (code.startsWith('//wrecked-name=')) {
                    const file = code.slice('//wrecked-name='.length, code.indexOf('\n'));
                    if (path === null) path = '/' + file;
                    line = line.replaceAll(match[0], file);
                }
            }
            if (path !== null && path in sourceMaps && applyMaps) {
                const after = line.slice(line.indexOf(path) + path.length + 1);
                const match = lineAndColnoRegex.exec(after);
                try {
                    applySourceMap(line, sourceMaps[path], path);
                } catch (error) {
                    handleError(error, false);
                }
            }
            msg[i] = line;
        }
        msg = msg.join('\n').replace(dataURIRegex, '<data uri>');
        if (showErrorsOnScreen) {
            if (document.readyState == 'complete') {
                document.body.innerHTML = `<pre style="font-size:14px;color:red;padding-left:15px;"></pre>`;
                document.querySelector('body pre').innerText = msg;
            } else {
                alert(msg);
            }
            let lastInterval = setInterval(()=>{},0);
            for (let i = 1; i <= lastInterval; i++) clearInterval(i);
            document.body.style.overflowY = 'auto';
            document.querySelectorAll('*').forEach((x) => x.style.userSelect = 'initial');
        }
        const out = new (error.constructor)(error.message);
        out.stack = error.stack;
        out.wreckedNoGrab = true;
        throw out;
    }
    
    window.onerror = (a, b, c, d, error) => handleError(error);
    
    window.onunhandledrejection = function(error) {
        if (error.reason instanceof Error) {
            handleError(error.reason);
        } else {
            handleError({constructor: Error, message: error.reason, stack: ''});
        }
    }
    
    const isFile = window.location.protocol == 'file:';
    
    function getExtType(path) {
        for (const [ext, type] of Object.entries(extTypes)) {
            if (path.endsWith(ext)) return type;
        }
        return 'text';
    }
    
    function simplifyPath(...paths) {
        let out = [];
        if (!paths[0].startsWith('/')) paths = [currentPath].concat(paths);
        for (const path of paths) {
            for (const item of path.split(pathSep)) {
                if (item == '' || item == '.') {
                    continue;
                } else if (item == '..') {
                    out.pop();
                } else {
                    out.push(item);
                }
            }
        }
        return '/' + out.filter((x) => x !== '').join('/');
    }
    
    function getNewImport(oldImport) {
        return (/^\.?\.?\//.test(oldImport) ? '_wrecked' : '.') + simplifyPath(oldImport);
    }
    
    const oldFetch = fetch;
    
    window.fetch = async function(url) {
        if (schemeRegex.test(url) || !isFile) {
            const resp = await oldFetch(url);
            if (!resp.headers.has('Content-Type')) {
                resp.headers.set('Content-Type', getExtType(url));
            }
            return resp;
        } else {
            url = simplifyPath(url);
            if (!(url in fileMap)) {
                return new Response('', {status: 404, statusText: 'Not Found'});
            }
            const file = fileMap[simplifyPath(url)];
            const code = typeof file == 'string' ? file : await file.text();
            const headers = {'Content-Type': getExtType(url)};
            return new Response(code, {status: 200, statusText: 'OK', headers: headers});
        }
    }
    
    async function loadScriptData(script) {
        if (script.data == undefined) {
            if (!script.src) return false;
            const resp = await fetch(script.src);
            if (resp.ok) {
                if (!script.type) script.type = resp.headers.get('Content-Type');
                script.data = await resp.text();
            } else {
                throw new TypeError(`Unable to access script '${script.src}' due to ${resp.status} ${resp.statusText}`);
            }
        }
        return script;
    }

    let tsLoaded = false;
    
    async function transpileTs(code, options = {}, path = '<no path provided>') {
        if (window.opener) {
            return new Promise((resolve, reject) => {
                function callback(event) {
                    window.removeEventListener('message', callback);
                    const data = event.data;
                    if (data.mode == 'response' && data.type == 'transpile_ts') {
                        if (data.request.path != path) return;
                        if (data.data instanceof Error) {
                            reject(data.data);
                        } else {
                            const code = data.data;
                            const match = sourceMapRegex.exec(code);
                            if (match) {
                                const match2 = dataURIRegex.exec(match[1]);
                                if (match2) {
                                    let map;
                                    try {
                                        sourceMaps[path] = JSON.parse(atob(match2[3]));
                                    } catch (err) {}
                                }
                            }
                            resolve(code);
                        }
                    }
                }
                window.addEventListener('message', callback);
                window.opener.postMessage({
                    mode: 'request',
                    type: 'transpile_ts',
                    data: {code: code, options: options, path: path},
                }, '*');
            });
        } else {
            if (!tsLoaded) await new Promise((resolve, reject) => {
                const elt = document.createElement('script');
                elt.src = 'https://unpkg.com/typescript@latest/lib/typescript.js'
                document.head.appendChild(elt);
                elt.addEventListener('load', () => {
                    tsLoaded = true;
                    resolve(true);
                });
            });
            return ts.transpile(code, options);
        }
    }
    
    async function patchScript(script) {
        let type = script.type;
        let code = script.data;
        const src = script.src;
        if (type == 'typescript' || type == 'javascript-jsx' || type == 'typescript-jsx') {
            code = await transpileTs(code, {target: 'es6', module: 'es6', jsx: type.includes('jsx'), inlineSourceMap: true}, simplifyPath(src));
            type = 'javascript';
        }
        if (type == 'javascript') {
            let matches = code.matchAll(importRegex);
            for (const match of matches) {
                let specifier = match[2];
                if (!(/^\.?\.?\//.test(specifier))) {
                    specifier = 'https://unpkg.com/' + specifier + '?module';
                } else {
                    specifier = '_wrecked' + simplifyPath(specifier);
                }
                code = code.replaceAll(match[0], match[1] + '"' + specifier + '"; // wrecked-no-grab=true\n');
            }
        } else if (type == 'css') {
            code = `(() => {
                const elt = document.createElement('style');
                elt.innerText = \`${code.replaceAll('`', '\\`').replaceAll('$', '\\$')}\`;
                document.head.appendChild(elt);
            });`;
        }
        return {type: type, data: code, src: src};
    }
    
    async function runScript(script) {
        script = await loadScriptData(script);
        if (!script) return;
        script = await patchScript(script);
        const elt = document.createElement('script');
        elt.setAttribute('data-wrecked-no-grab', 'true');
        if (script.type == 'importmap') {
            elt.textContent = script.data;
            elt.type = 'importmap';
        } else {
            elt.textContent = `import * as _ from '${getNewImport(script.src)}'`;
            elt.type = 'module';
        }
        document.body.appendChild(elt);
    }
    
    async function initialRun() {
        const scriptsCopy = scripts.slice();
        let map = {};
        while (scripts.length > 0) {
            const script = await loadScriptData(scripts.pop());
            if (!script) continue;
            script.data.matchAll(importRegex).forEach((match) => {
                const specifier = match[2];
                if ((/^\.?\.?\//.test(specifier))) {
                    scripts.push({src: specifier, type: getExtType(specifier)});
                }
            });
            if (script.src) {
                const specifier = getNewImport(script.src);
                const patched = await patchScript(await loadScriptData(script));
                map[specifier] = 'data:text/javascript;base64,' + btoa(`//wrecked-name=${simplifyPath(script.src).slice(1)}\n` + patched.data);
            }
        }
        await runScript({type: 'importmap', data: JSON.stringify({imports: map})});
        for (const script of scriptsCopy) {
            await runScript(script);
        }
    }
    
    function interceptScript(script) {
        if (script.tagName && script.tagName == 'SCRIPT' && !script.getAttribute('data-wrecked-no-grab')) {
            if ((/^\s*\/\/[^\n]*wrecked-no-grab=true/.test(script.textContent))) return;
            console.log(script);
            let type = script.getAttribute('type');
            if (type !== null && type.startsWith('wrecked/')) type = type.slice(8);
            script.setAttribute('type', 'text/plain');
            script.parentNode.removeChild(script);
            script.setAttribute('data-wrecked-no-grab', 'true');
            const src = script.getAttribute('src');
            if (src && src !== '<anonymous code>') {
                scripts.push({type: type, src: src});
            } else {
                scripts.push({type: type, data: script.textContent});
            }
        }
    }
    
    document.querySelectorAll('script').forEach(interceptScript);
    
    new MutationObserver(function(mutations) {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                interceptScript(node);
            }
        }
    }).observe(document.documentElement, {childList: true, subtree: true});
    
    if (window.opener) {
        window.addEventListener('message', async function(event) {
            const {mode, type, request, data} = event.data;
            if (mode == 'response') {
                if (type == 'filemap') {
                    fileMap = data;
                    if (currentPath !== null) initialRun();
                } else if (type == 'currentpath') {
                    currentPath = data;
                    if (fileMap !== null) initialRun();
                }
            }
        });
        window.opener.postMessage({
            mode: 'request',
            type: 'filemap',
        }, '*');
        window.opener.postMessage({
            mode: 'request',
            type: 'currentpath',
        }, '*');
    } else {
        currentPath = '/';
        window.addEventListener('load', initialRun);
    }
    
    window.require = async function(path) {
        const script = await fileMap[simplifyPath(path)].text();
        const out = {require: require, module: {exports: {}}};
        Function(`'use strict'; ${script}`).bind(out)();
        return out.module.exports;
    }
    
})();
