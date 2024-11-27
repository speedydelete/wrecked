
// wrecked-no-grab=true

(function() {

    const showErrorsOnScreen = false;

    const dataURIRegex = /data:([a-zA-Z0-9!#$&.+-^_]+\/[a-zA-Z0-9!#$&.+-^_]+)?(;[a-zA-Z0-9!#$&.+-^_]+)*;base64,[A-Za-z0-9+/]+={0,2}/g;
    const importRegex = /^(?:(import(?:\s+\*\s+as\s+\w+|\s+\w+|\s*\{[^}]*\})\s+from\s+)["']([^"']+)["'];?)(?:\s*)(?!\/\/\s*wrecked-no-grab=true)\n/m;
    const schemeRegex = /^[a-z][a-z\d+\-.]*:/;

    if (showErrorsOnScreen) {
        window.onerror = function(a, b, c, d, error) {
            let text = error.stack.toString()
            text = text.replace(dataURIRegex, '<data uri>');
            if (document.readyState == 'complete') {
                document.body.innerHTML = `<pre style="font-size:14px;color:red;padding-left:15px;"></pre>`;
                document.querySelector('body pre').innerText = text4
            } else {
                alert(text);
            }
            let lastInterval = setInterval(()=>{},0);
            for (let j=1;j<=i;j++) clearInterval(j)
        }
        window.onunhandledrejection = function(error) {
            onerror(null, null, null, null, {stack: e.reason.stack ? e.reason.stack : e.reason});
        }
    }
    
    const pathSep = /(?<!\\)\//;
    let fileMap = null;
    let currentPath = null;
    let scripts = [];

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

    if (window.location.protocol == 'file:') {
        const oldFetch = fetch;
        window.fetch = async function(url) {
            if (schemeRegex.test(url)) return await oldFetch(url);
            const path = simplifyPath(url);
            if (typeof fileMap[path] == 'string') return fileMap[path];
            let code = await fileMap[path].text();
            let match = importRegex.exec(code);
            while (match) {
                let specifier = match[2];
                if (!(/^\.?\.?\//.test(specifier))) {
                    specifier = 'https://unpkg.com/' + specifier + '?module';
                } else {
                    specifier = '_wrecked' + simplifyPath(specifier);
                }
                code = code.replace(match[0], match[1] + '"' + specifier + '"; // wrecked-no-grab=true\n');
                match = importRegex.exec(code);
            }
            return new Response(code, {'status': 200, 'statusText': 'OK'});
        }
    }

    async function runScript(script) {
        const {type, src} = script;
        let {data} = script;
        if (data == undefined) {
            if (!src) return;
            data = await fetch(src);
        }
        if (type == 'importmap') {
            const map = JSON.parse(data);
            let imports = [];
            for (const [key, value] of Object.entries(map.imports)) {
                imports.push([key, await getURL(value)]);
            }
            map.imports = Object.fromEntries(imports);
            data = JSON.stringify(map);
        }
        const elt = document.createElement('script');
        elt.textContent = data;
        elt.setAttribute('data-wrecked-no-grab', 'true');
        elt.type = type;
        document.body.appendChild(elt);
    }

    async function initialRun() {
        const imports = Object.fromEntries(Object.keys(fileMap).map((k) => ['_wrecked' + k, k]));
        await runScript({type: 'importmap', data: JSON.stringify({imports: imports})});
        for (const script of scripts) {
            await runScript(script);
        }
    }

    function interceptScript(script) {
        if (script.tagName && script.tagName == 'SCRIPT' && !script.getAttribute('data-wrecked-no-grab')) {
            const type = script.getAttribute('type');
            script.setAttribute('type', 'text/plain');
            script.parentNode.removeChild(script)
            script.setAttribute('data-wrecked-no-grab', 'true');
            src = script.getAttribute('src');
            if (src && src !== '<anonymous code>') {
                if (window.location.protocol == 'file:') {
                    scripts.push({type: type, src: src});
                } else {
                    fetch(script.src).then(function(resp) {
                        if (resp.ok) {
                            resp.text().then((text) => scripts.push({
                                type: type,
                                data: text,
                            }));
                        } else {
                            console.error(`Unable to fetch script from ${script.src} due to a ${resp.status} ${resp.statusText} `);
                        }
                    });
                }  
            } else {
                if (!(/^\s+\/\/[^\n]*wrecked-no-grab=true/.test(script.textContent))) return;
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
    }
    
    window.require = async function(path) {
        const script = await fileMap[resolvePath(path)].text();
        const out = {require: require, module: {exports: {}}};
        Function(`'use strict'; ${script}`).bind(out)();
        return out.module.exports;
    }

})();