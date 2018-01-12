const electron = require('electron');
const Datastore = require('nedb');
const path = require('path');


const { ipcMain } = electron;

process.on('uncaughtException', err => {
    console.error(err);
});

const { app, BrowserWindow } = electron;

app.on('ready', () => {

    const dataPath = app.getPath('userData');

    const ordersDB = new Datastore({ filename: path.join(dataPath, 'orders.db'), autoload: true });

    const appWindow = new BrowserWindow({
        show: false,
        width: 700,
        height: 485
    });

    appWindow.loadURL(`file://${__dirname}/index.html`);
    appWindow.once('ready-to-show', () => {
        appWindow.show();
    });

    const sendOrders = () => {
        ordersDB.find({}, (err, docs) => {
            if(err) {
                console.error(err);
            } else {
                appWindow.send('orders', docs);
            }
        });
    };

    ipcMain.on('createOrder', (e, order) => {
        ordersDB.insert(order, err => {
            if(err) {
                console.error(err);
            } else {
                sendOrders();
            }
        });
    });

    ipcMain.on('getOrders', () => {
        sendOrders();
    });

});

app.on('window-all-closed', () => {
    app.quit();
});
