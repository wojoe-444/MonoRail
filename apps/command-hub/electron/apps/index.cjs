// Registry of app backends (the main-process half of the app contract).
// Same shape as module backends: { id, methods: { [name]: async (ctx, args) => result } }.
// ctx.dataDir for an app is %APPDATA%\MonoHub\apps\<id>.

module.exports = [require('./github-plus/index.cjs')]
