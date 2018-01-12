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

    const orderDB = new Datastore({ filename: path.join(dataPath, 'orders.db'), autoload: true });
    const addressDB = new Datastore({ filename: path.join(dataPath, 'addresses.db'), autoload: true });

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
        orderDB.find({}, (err, docs) => {
            if(err) {
                console.error(err);
            } else {
                appWindow.send('orders', docs);
            }
        });
    };

    ipcMain.on('createOrder', (e, order) => {
        orderDB.insert(order, err => {
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

    const sendAddresses = () => {
        addressDB.find({}, (err, docs) => {
            if(err) {
                console.error(err);
            } else {
                appWindow.send('addresses', docs);
            }
        });
    };

    ipcMain.on('createAddress', (e, { coin, address }) => {
        addressDB.update({ coin }, { coin, address }, { upsert: true }, err => {
            if(err) {
                console.error(err);
            } else {
                sendAddresses();
            }
        });
    });

    ipcMain.on('getAddresses', () => {
        sendAddresses();
    });

});

app.on('window-all-closed', () => {
    app.quit();
});
