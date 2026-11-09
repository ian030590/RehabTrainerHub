# /setup-engine: Read Installed Versions

Read root package.json and package-lock.json, including packageManager, then
each in-scope game's package.json. Record dependency/devDependency declarations
as exact pins or ranges. Resolve each against lockfile packages entries:
workspace-local node_modules first when present, otherwise root node_modules.
Report multiple versions separately; never silently select the highest.

Sensor libraries declared only at root belong to runner input proxies. Label
them separately; they never authorize game dependencies or direct media capture.
Missing resolutions stay unresolved. No WebSearch, memory-based versions,
package install or automatic upgrade. Read docs/engine-reference/web/VERSION.md.
