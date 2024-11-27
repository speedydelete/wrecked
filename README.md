# WRECKED
WRECKED is the Working Development Environment Creation Kit Enabling Debugging. To use it, include the client.min.js
file in your code. 

When running on the file: protocol (if your program has multiple files) you need to use the server. To use it, first select the folder containing your code. Enter in the file path of the file you want to run in the text box. Then, click the button, which will open your program in a new tab.
## Errors
Errors can be shown onscreen by toggling showOnscreenErrors in the client.
## Language Support
You can put code in these languages in script tags or standalone, and it will run them:
* JavaScript: Use type="text/javascript" (or no type at all, it's the default)
* TypeScript: Use type="text/typescript"
* JavaScript JSX: Use type="text/jsx"
* TypeScript JSX: Ues type="text/tsx"
* Python: Use type="text/python"
## Imports
You can import modules normally, relative imports work, import maps work, and even ones that aren't installed from npm can be imported. WRECKED does some tricks to make this work.
## Installing Modules
You can import modules normally, relative imports work, and import maps work. WRECKED does some tricks to make this work.

WRECKED can install modules from npm and pip. On the right is a menu to select installable modules. Some modules 
may not work or have limited functionality due to WRECKED running in a browser. Installed modules are only installed
in the current folder.

Modules on npm that aren't installed in the server can still be imported, installing them server-side just makes it
faster.