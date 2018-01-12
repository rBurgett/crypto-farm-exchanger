import moment from 'moment';
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import shapeshift from 'shapeshift.io';
import swal from 'sweetalert';
import { ipcRenderer } from 'electron';

const styles = {
    header: {
        marginTop: 10
    },
    tableRow: {
        cursor: 'pointer'
    }
};

const handleError = err => {
    console.error(err);
    swal('Oops!', err.message, 'error');
};

class Orders extends Component {

    constructor(props) {
        super(props);
        this.state = {
            orders: []
        };
    }

    async componentWillMount() {
        try {
            let statusInterval;
            ipcRenderer.on('orders', async function(e, orders) {
                if(statusInterval) clearInterval(statusInterval);
                orders = orders
                    .map(o => ({
                        ...o,
                        status: o.status ? o.status : ''
                    }))
                    .sort((a, b) => a.expiration === b.expiration ? 0 : a.expiration > b.expiration ? -1 : 1)
                this.setState({
                    ...this.state,
                    orders
                });
                const updateOrders = async function() {
                    const updatedOrders = [...orders];
                    for(let i = 0; i < updatedOrders.length; i++) {
                        const order = updatedOrders[i];
                        if(order.status === 'complete' || order.status === 'expired') {
                            continue;
                        } else {
                            const { status } = await new Promise((resolve, reject) => {
                                shapeshift.status(order.deposit, (err, s, data) => {
                                    if(err) {
                                        reject(err);
                                    } else {
                                        resolve(data);
                                    }
                                });
                            });
                            if(status === 'complete') {
                                updatedOrders[i] = {
                                    ...updatedOrders[i],
                                    status: 'complete'
                                };
                            } else if(status !== 'received' && new Date().getTime() > order.expiration) {
                                updatedOrders[i] = {
                                    ...updatedOrders[i],
                                    status: 'expired'
                                };
                            } else {
                                updatedOrders[i] = {
                                    ...updatedOrders[i],
                                    status
                                };
                            }
                            await ipcRenderer.send('updateOrder', updatedOrders[i], true);
                        }
                    }
                    this.setState({
                        ...this.state,
                        orders: updatedOrders
                    });
                }.bind(this);
                updateOrders();
                statusInterval = setInterval(() => updateOrders(), 30000);
            }.bind(this));
            ipcRenderer.send('getOrders');
        } catch(err) {
            handleError(err);
        }
    }

    render() {

        const { state } = this;
        console.log('state', state);

        const { orders } = state;

        return (
            <div className={'container-fluid'}>
                <div className={'row'}>
                    <div className={'col-sm-12'}>
                        <h2 style={styles.header}>Orders</h2>
                    </div>
                </div>
                <div className={'row'}>
                    <div className={'col-sm-12'}>
                        <table className={'table table-hover table-condensed'}>
                            <thead>
                                <tr>
                                    <th>From</th>
                                    <th>To</th>
                                    <th>Deposit Amount</th>
                                    <th>Receive Amount</th>
                                    <th>Expiration</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                            {
                                orders.map(order => {
                                    const splitPair = order.pair.split('_');
                                    const depositCoin = splitPair[0].toUpperCase();
                                    const receiveCoin = splitPair[1].toUpperCase();

                                    const expiration = moment(new Date(order.expiration)).format('L - LT');

                                    const onClick = e => {
                                        e.preventDefault();
                                        swal({
                                            title: 'Order Details',
                                            text: [
                                                'Status: ' + order.status,
                                                'Withdrawal Coin: ' + receiveCoin,
                                                'Withdrawal Amount: ' + order.withdrawalAmount + ' ' + receiveCoin,
                                                'Withdrawal Address:',
                                                order.withdrawal,
                                                'Miner Fee: ' + order.minerFee + ' ' + receiveCoin,
                                                'Deposit Coin: ' + depositCoin,
                                                'Deposit Amount: ' + order.depositAmount + ' ' + depositCoin,
                                                'Deposit Address:',
                                                order.deposit,
                                                'Refund Address:',
                                                order.returnAddress,
                                                'Expiration: ' + expiration
                                            ].join('\n')
                                        });
                                    };

                                    return (
                                        <tr key={order._id} style={styles.tableRow} onClick={onClick}>
                                            <td>{depositCoin}</td>
                                            <td>{receiveCoin}</td>
                                            <td>{order.depositAmount + ' ' + depositCoin}</td>
                                            <td>{order.withdrawalAmount + ' ' + receiveCoin}</td>
                                            <td>{expiration}</td>
                                            <td>{order.status}</td>
                                        </tr>
                                    );
                                })
                            }
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

}

(async function() {
    try {
        ReactDOM.render(
            <Orders />,
            document.getElementById('js-app')
        );
    } catch(err) {
        handleError(err);
    }
})();
