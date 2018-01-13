const electron = require('electron');
const fs = require('fs-extra-promise');
const Datastore = require('nedb');
const path = require('path');

const { ipcMain } = electron;

process.on('uncaughtException', err => {
    console.error(err);
});

const { app, BrowserWindow } = electron;

let windows = [];

const windowHeight = process.platform === 'darwin' ? 485 : 510;

app.on('ready', () => {

    let dataPath;
    if(process.platform === 'win32') {
        const { name } = fs.readJSONSync(path.join(__dirname, 'package.json'));
        dataPath = path.join(process.env.LOCALAPPDATA, name);
    } else {
        dataPath = app.getPath('userData');
    }

    const orderDB = new Datastore({ filename: path.join(dataPath, 'orders.db'), autoload: true });
    const addressDB = new Datastore({ filename: path.join(dataPath, 'addresses.db'), autoload: true });

    const appWindow = new BrowserWindow({
        show: false,
        width: 700,
        height: windowHeight
    });
    windows.push(appWindow);

    appWindow.loadURL(`file://${__dirname}/index.html`);
    appWindow.once('ready-to-show', () => {
        appWindow.show();
    });

    const sendOrders = () => {
        orderDB.find({}, (err, docs) => {
            if(err) {
                console.error(err);
            } else {
                for(const w of windows) {
                    w.send('orders', docs);
                }
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

    ipcMain.on('updateOrder', (e, order, skip) => {
        orderDB.update({ _id: order._id }, order, err => {
            if(err) {
                console.error(err);
            } else {
                if(!skip) sendOrders();
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

    ipcMain.on('showOrders', () => {

        const { x, y } = appWindow.getBounds();

        const ordersWindow = new BrowserWindow({
            show: false,
            x: x + 30,
            y: y + 30,
            width: 700,
            height: windowHeight
        });
        windows.push(ordersWindow);

        ordersWindow.loadURL(`file://${__dirname}/orders.html`);
        ordersWindow.once('ready-to-show', () => {
            ordersWindow.show();
        });
        ordersWindow.on('close', () => {
            windows = windows.filter(w => w !== ordersWindow);
        });

    });

});

app.on('window-all-closed', () => {
    app.quit();
});
