const electron = require('electron');

process.on('uncaughtException', err => {
    console.error(err);
});

const { app, BrowserWindow } = electron;

app.on('ready', () => {

    const appWindow = new BrowserWindow({
        show: false,
        width: 500,
        height: 500
    });

    appWindow.loadURL(`file://${__dirname}/index.html`);
    appWindow.once('ready-to-show', () => {
        appWindow.show();
    });

});

app.on('window-all-closed', () => {
    app.quit();
});
