
// wrecked-no-grab=true

const showErrorsOnScreen = false;

if (showErrorsOnScreen) {
    onerror = function(a, b, c, d, error) {
        let text = error.stack.toString()
        text = text.replace(/data:([a-zA-Z0-9!#$&.+-^_]+\/[a-zA-Z0-9!#$&.+-^_]+)?(;[a-zA-Z0-9!#$&.+-^_]+)*;base64,[A-Za-z0-9+/]+={0,2}/g, '<data uri>');
        if (document.readyState == 'complete') {
            document.body.innerHTML = `<pre style="font-size:14px;color:red;padding-left:15px;"></pre>`;
            document.querySelector('body pre').innerText = text4
        } else {
            alert(text);
        }
        let lastInterval = setInterval(()=>{},0);
        for (let j=1;j<=i;j++) clearInterval(j)
    }
    onunhandledrejection = function(error) {
        onerror(null, null, null, null, {stack: e.reason.stack ? e.reason.stack : e.reason});
    }
}

const wrecked = {
    pathSep: /(?<!\\)\//,
    fileMap: null,
    currentPath: null,
    scripts: [],
    importRegex: /^(?:(import(?:\s+\*\s+as\s+\w+|\s+\w+|\s*\{[^}]*\})\s+from\s+)["']([^"']+)["'];?)(?:\s*)(?!\/\/\s*wrecked-no-grab=true)\n/m,
    simplifyPath: function(...paths) {
        let out = [];
        if (!paths[0].startsWith('/')) paths = [this.currentPath].concat(paths);
        for (const path of paths) {
            for (const item of path.split(this.pathSep)) {
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
    },
    getURL: async function(url) {
        if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('data:')) return url;
        const path = this.simplifyPath(url);
        // alert(url + '\n\n' + path);
        if (typeof this.fileMap[path] == 'string') return this.fileMap[path];
        // const oldBlob = await this.fileMap[path];
        // const type = script.type == 'module' ? 'text/javascript' : script.type;
        // const newBlob = new Blob([await oldBlob.text()], {type: script.type});
        // return URL.createObjectURL(newBlob);
        let code = await this.fileMap[path].text();
        let match = this.importRegex.exec(code);
        let out = '';
        while (match) {
            let [full, main, specifier] = match;
            if (specifier == 'three') {
                specifier = 'https://unpkg.com/three@0.170.0/build/three.module.js?module';
            } else if (specifier.startsWith('three/addons/')) {
                specifier = 'https://unpkg.com/three@0.170.0/examples/jsm/' + specifier.slice('three/addons/'.length) + '?module';
            } else {
                specifier = '_wrecked' + this.simplifyPath(specifier);
            }
            code = code.replace(full, main + '"' + specifier + '"; // wrecked-no-grab=true\n');
            match = this.importRegex.exec(code);
        }
        return 'data:text/javascript;base64,' + btoa(code);
    },
    runScript: async function(script) {
        if (script.action == 'run') {
            if (script.type == 'text/javascript' || script.type == 'module') {
                const elt = document.createElement('script');
                elt.type = script.type;
                if (script.data) {
                    elt.textContent = script.data;
                } else if (script.src) {
                    elt.src = await this.getURL(script.src);
                }
                elt.setAttribute('data-wrecked-no-grab', 'true');
                document.body.appendChild(elt);
            } else if (script.type == 'importmap') {
                const map = JSON.parse(script.data);
                let imports = [];
                for (const [key, value] of Object.entries(map.imports)) {
                    imports.push([key, await this.getURL(value)]);
                }
                map.imports = Object.fromEntries(imports);
                const elt = document.createElement('script');
                elt.textContent = JSON.stringify(map);
                elt.setAttribute('data-wrecked-no-grab', 'true');
                elt.type = 'importmap';
                // alert(elt.textContent);
                document.body.appendChild(elt);
            }
        }
    },
    initialRun: async function() {
        let i = 0;
        await this.runScript({
            action: 'run',
            type: 'importmap',
            data: JSON.stringify({imports: Object.fromEntries(Object.keys(this.fileMap).map((k) => ['_wrecked' + k, k]))}),
        });
        for (const script of this.scripts) {
            await this.runScript(script);
        }
    },
    interceptScript: function(script) {
        if (script.tagName && script.tagName == 'SCRIPT' && !script.getAttribute('data-wrecked-no-grab')) {
            const type = script.getAttribute('type');
            script.setAttribute('type', 'text/plain');
            script.parentNode.removeChild(script)
            script.setAttribute('data-wrecked-no-grab', 'true');
            src = script.getAttribute('src');
            if (src && src !== '<anonymous code>') {
                if (window.location.protocol == 'file:') {
                    this.scripts.push({
                        action: 'run',
                        type: type,
                        src: src,
                    });
                } else {
                    fetch(script.src).then(function(resp) {
                        if (resp.ok) {
                            resp.text().then((text) => this.scripts.push({
                                action: 'run',
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
                this.scripts.push({
                    action: 'run',
                    type: type,
                    data: script.textContent,
                });
            }
        }
    },
    observer: function(mutations) {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                this.interceptScript(node);
            }
        }
    },
    onload: function() {
    },
    onmessage: async function(event) {
        const {mode, type, request, data} = event.data;
        if (mode == 'response') {
            if (type == 'filemap') {
                // alert(`${Object.values(data).reduce((a, b) => a + b.size, 0)} bytes\n${JSON.stringify(data)}`);
                wrecked.fileMap = data;
                if (this.currentPath !== null) this.initialRun();
            } else if (type == 'currentpath') {
                wrecked.currentPath = data;
                if (this.fileMap !== null) this.initialRun();
            }
        }
    },
    init: function() {
        document.querySelectorAll('script').forEach(this.interceptScript);
        new MutationObserver(this.observer.bind(this)).observe(document.documentElement, {childList: true, subtree: true});
        window.addEventListener('load', this.onload.bind(this));
        window.addEventListener('message', this.onmessage.bind(this));
        window.opener.postMessage({
            mode: 'request',
            type: 'filemap',
        }, '*');
        window.opener.postMessage({
            mode: 'request',
            type: 'currentpath',
        }, '*');
    }
}

async function require(path) {
    const script = await wrecked.fileMap[wrecked.resolvePath(path)].text();
    const out = {require: require, module: {exports: {}}};
    Function(`'use strict'; ${script}`).bind(out)();
    return out.module.exports;
}

wrecked.init();
