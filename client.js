
// wrecked-no-grab=true

(function() {

    const showErrorsOnScreen = false;

    const dataURIRegex = /data:([a-zA-Z0-9!#$&.+-^_]+\/[a-zA-Z0-9!#$&.+-^_]+)?(;[a-zA-Z0-9!#$&.+-^_]+)*;base64,([A-Za-z0-9+/]+={0,2})/g;
    const importRegex = /^(?:(import(?:\s+\*\s+as\s+\w+|\s+\w+|\s*\{[^}]*\})\s+from\s+)["']([^"']+)["'];?)(?:\s*)(?!\/\/\s*wrecked-no-grab=true)\n/mg;
    const schemeRegex = /^[a-z][a-z\d+\-.]*:/;
    const pathSep = /(?<!\\)\//;
    const extTypes = {
        '.js': 'javascript',
    };

    function handleError(error) {
        let stack = error.stack;
        const matches = stack.matchAll(dataURIRegex);
        for (const match of matches) {
            const code = atob(match[3]);
            if (code.startsWith('//wrecked-name=')) {
                stack = stack.replaceAll(match[0], code.slice('//wrecked-name='.length, code.indexOf('\n')));
            }
        }
        stack = stack.replace(dataURIRegex, '<data uri>');
        if (showErrorsOnScreen) {
            if (document.readyState == 'complete') {
                document.body.innerHTML = `<pre style="font-size:14px;color:red;padding-left:15px;"></pre>`;
                document.querySelector('body pre').innerText = stack;
            } else {
                alert(stack);
            }
            let lastInterval = setInterval(()=>{},0);
            for (let i = 1; i <= lastInterval; i++) clearInterval(i);
        } else {
            const out = new (error.constructor)(error.message);
            out.stack = stack;
            throw out;
        }
    }

    window.onerror = (a, b, c, d, error) => handleError(error);

    window.onunhandledrejection = function(error) {
        if (error instanceof Error) {
            handleError(error);
        } else {
            handleError({constructor: Error, message: error.message, stack: ''});
        }
    }

    const isFile = window.location.protocol == 'file:';

    let fileMap = null;
    let currentPath = null;
    let scripts = [];

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

    const oldFetch = fetch;

    window.fetch = async function(url) {
        if (schemeRegex.test(url) || !isFile) {
            const resp = await oldFetch(url);
            if (!resp.headers.has('Content-Type')) {
                resp.headers.set('Content-Type', getExtType(url));
            }
            return resp;
        } else {
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
            if (!script.type) script.type = resp.headers.get('Content-Type');
            script.data = await resp.text();
        }
        return script;
    }

    async function patchScript(script) {
        const type = script.type;
        let code = script.data;
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
        }
        return {type: type, data: code};
    }

    async function runScript(script) {
        script = await loadScriptData(script);
        if (!script) return;
        script = await patchScript(script);
        const elt = document.createElement('script');
        elt.textContent = script.data;
        elt.setAttribute('data-wrecked-no-grab', 'true');
        elt.type = script.type == 'importmap' ? 'importmap' : 'module';
        console.log('running', elt.textContent.replace(dataURIRegex, '<data uri>'));
        document.body.appendChild(elt);
    }

    async function initialRun() {
        const scriptsCopy = scripts.slice();
        let map;
        if (isFile) {
            map = Object.fromEntries(Object.keys(fileMap).map((k) => ['_wrecked' + k, k]));
        } else {
            map = {};
            while (scripts.length > 0) {
                const script = await loadScriptData(scripts.pop());
                if (!script) return;
                script.data.matchAll(importRegex).forEach((match) => {
                    const specifier = match[2];
                    if ((/^\.?\.?\//.test(specifier))) {
                        scripts.push({src: specifier, type: getExtType(specifier)});
                    }
                });
                if (script.src) {
                    const specifier = (/^\.?\.?\//.test(script.src) ? '_wrecked' : '.') + simplifyPath(script.src);
                    const patched = await patchScript(await loadScriptData(script));
                    map[specifier] = 'data:text/javascript;base64,' + btoa(`//wrecked-name=${script.src}\n` + patched.data);
                }
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
