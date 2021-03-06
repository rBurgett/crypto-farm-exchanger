import fs from 'fs-extra-promise';
import fx from 'money';
import moment from 'moment';
import oxr from 'open-exchange-rates';
import path from 'path';
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import shapeshift from 'shapeshift.io';
import swal from 'sweetalert';
import { bindAll } from 'lodash';
import { ipcRenderer } from 'electron';

import CoinSelector from './components/coin-selector';
import ExchangeForm from './components/exchange-form';

const { EXCHANGE_KEY } = fs.readJsonSync(path.join(__dirname, '.env'));

oxr.set({ app_id: EXCHANGE_KEY });

const handleError = err => {
    console.error(err);
    swal('Oops!', err.message, 'error');
};

const updateRates = async function() {
    await new Promise(resolve => {
        oxr.latest(() => resolve());
    });
    fx.rates = oxr.rates;
    fx.base = oxr.base;
};

const getMarketInfo = async function(depositCoin, receiveCoin) {
    const pair = depositCoin.toLowerCase() + '_' + receiveCoin.toLowerCase();
    const res = await Promise.all([
        new Promise((resolve, reject) => {
            shapeshift.marketInfo(pair, function (err, marketInfo) {
                if(err) {
                    reject(err);
                } else {
                    /* =>
                      {
                        "rate": "121.25912408",
                        "limit": 2.24854014,
                        "pair": "btc_ltc",
                        "minimum": 0.0000492,
                        "minerFee": 0.003
                      }
                    */
                    resolve(marketInfo);
                }
            });
        }),
        new Promise((resolve, reject) => {
            shapeshift.marketInfo(`btc_${receiveCoin.toLowerCase()}`, function (err, marketInfo) {
                if(err) {
                    reject(err);
                } else {
                    resolve(marketInfo);
                }
            });
        })
    ]);
    return res;
};

const getDollarAmount = (amount, marketInfo) => {
    const multiplier = 1000000000;
    const btcAmount = ((multiplier / (marketInfo.rate * multiplier)) * (amount * multiplier)) / multiplier;
    return fx(btcAmount).from('BTC').to('USD');
};

const styles = {
    header: {
        marginTop: 10
    },
    ordersButton: {
        fontSize: 20,
        lineHeight: '20px',
        paddingLeft: 7,
        paddingRight: 9,
        paddingTop: 5,
        paddingBottom: 5
    }
};

class App extends Component {

    constructor(props) {
        super(props);
        this.state = {
            depositCoin: '',
            refundAddress: '',
            receiveCoin: '',
            receiveAddress: '',
            marketInfo: '',
            btcMarketInfo: '',
            receiveAmount: '',
            coins: [],
            orders: [],
            addresses: []
        };
        bindAll(this, [
            'onDepositCoinChange',
            'onReceiveCoinChange',
            'onCoinSwitch',
            'onReceiveAmountChange',
            'onReceiveAddressChange',
            'onRefundAddressChange',
            'onSubmit',
            'onShowOrdersClick'
        ]);
    }

    async componentWillMount() {
        try {
            const coins = await new Promise((resolve, reject) => {
                shapeshift.coins((err, data) => {
                    if(err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            });
            const coinsArr = Object
                .keys(coins)
                .map(key => coins[key])
                .filter(c => c.status === 'available')
                .sort((a, b) => a.symbol.localeCompare(b.symbol));
            let depositCoin, receiveCoin;
            const hasBTC = coinsArr.some(c => c.symbol === 'BTC');
            const hasETH = coinsArr.some(c => c.symbol === 'ETH');
            if(hasBTC && hasETH) {
                depositCoin = 'BTC';
                receiveCoin = 'ETH';
            } else if(hasBTC) {
                depositCoin = 'BTC';
                const receiveIdx = coins.findIndex(c => c.symbol !== depositCoin);
                receiveCoin = coins[receiveIdx].symbol;
            } else if(hasETH) {
                depositCoin = 'ETH';
                const receiveIdx = coins.findIndex(c => c.symbol !== depositCoin);
                receiveCoin = coins[receiveIdx].symbol;
            } else {
                depositCoin = coins[0].symbol;
                receiveCoin = coins[1].symbol;
            }
            const [ marketInfo, btcMarketInfo ] = await getMarketInfo(depositCoin, receiveCoin);
            this.setState({
                ...this.state,
                coins: coinsArr,
                depositCoin,
                receiveCoin,
                marketInfo,
                btcMarketInfo
            });

            await updateRates();

            // update the exchange rates every fifteen minutes
            setInterval(() => updateRates(), 60 * 15 * 1000);

            ipcRenderer.on('orders', (e, orders) => {
                this.setState({
                    ...this.state,
                    orders: orders
                        .sort((a, b) => a.expiration === b.expiration ? 0 : a.expiration > b.expiration ? -1 : 1)
                });
            });
            ipcRenderer.send('getOrders');

            ipcRenderer.on('addresses', (e, addresses) => {
                this.setState({
                    ...this.state,
                    addresses
                });
            });
            ipcRenderer.send('getAddresses');

        } catch(err) {
            handleError(err);
        }
    }

    async onDepositCoinChange(coin) {
        const { receiveCoin, addresses } = this.state;
        const addressObj = addresses.find(a => a.coin === coin) || {};
        this.setState({
            ...this.state,
            depositCoin: coin,
            refundAddress: addressObj.address ? addressObj.address : ''
        });
        const [ marketInfo, btcMarketInfo ] = await getMarketInfo(coin, receiveCoin);
        this.setState({
            ...this.state,
            marketInfo,
            btcMarketInfo
        });
    }

    async onReceiveCoinChange(coin) {
        const { depositCoin, addresses } = this.state;
        const addressObj = addresses.find(a => a.coin === coin) || {};
        this.setState({
            ...this.state,
            receiveCoin: coin,
            receiveAddress: addressObj.address ? addressObj.address : ''
        });
        const [ marketInfo, btcMarketInfo ] = await getMarketInfo(depositCoin, coin);
        this.setState({
            ...this.state,
            marketInfo,
            btcMarketInfo
        });
    }

    async onCoinSwitch() {
        const { state } = this;
        const { depositCoin, refundAddress, receiveCoin, receiveAddress } = state;
        this.setState({
            ...state,
            depositCoin: receiveCoin,
            refundAddress: receiveAddress,
            receiveCoin: depositCoin,
            receiveAddress: refundAddress
        });
        const [ marketInfo, btcMarketInfo ] = await getMarketInfo(receiveCoin, depositCoin);
        this.setState({
            ...this.state,
            marketInfo,
            btcMarketInfo
        });
    }

    onReceiveAmountChange(receiveAmount) {
        this.setState({
            ...this.state,
            receiveAmount
        });
    }

    onReceiveAddressChange(receiveAddress) {
        this.setState({
            ...this.state,
            receiveAddress
        });
    }

    onRefundAddressChange(refundAddress) {
        this.setState({
            ...this.state,
            refundAddress
        });
    }

    async onSubmit(e) {
        try {
            e.preventDefault();

            const confirmed = await swal({
                title: 'User Agreement',
                text: 'Use of this software may carry financial risk, and is to be used as an experimental software utility only. In no event shall the application developers or MLGA Crypto Farm be liable or responsible for any damages, claims, applications, losses, injuries, delays, accidents, costs, business interruption costs, or other expenses. The application developers and MLGA Crypto Farm are hereby released by you from liability for any and all Losses.',
                type: 'warning',
                buttons: {
                    confirm: 'I agree. Continue.',
                    cancel: 'Cancel'
                }
            });

            if(!confirmed) return;

            const { receiveCoin, depositCoin, receiveAmount } = this.state;
            const refundAddress = this.state.refundAddress.trim();
            const receiveAddress = this.state.receiveAddress.trim();
            const pair = depositCoin.toLowerCase() + '_' + receiveCoin.toLowerCase();
            const options = {
                returnAddress: refundAddress,
                amount: receiveAmount
            };

            swal({
                title: 'Processing Order...',
                buttons: false,
                closeOnClickOutside: false,
                closeOnEsc: false
            });

            const orderData = await new Promise((resolve, reject) => {
                shapeshift.shift(receiveAddress, pair, options, (err, data) => {
                    if(err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            });

            await ipcRenderer.send('createOrder', orderData);
            await ipcRenderer.send('createAddress', { coin: depositCoin, address: refundAddress });
            await ipcRenderer.send('createAddress', { coin: receiveCoin, address: receiveAddress });

            await swal({
                title: 'Order successfully processed!',
                text: [
                    'Payment Amount:',
                    orderData.depositAmount + ' ' + depositCoin,
                    '\n',
                    'Payment Address:',
                    orderData.deposit,
                    '\n',
                    `Please send the amount above to the payment address by ${moment(new Date(orderData.expiration)).format('LT')}.`
                ].join('\n'),
                button: 'Close'
            });

            this.setState({
                ...this.state,
                receiveAmount: ''
            });

        } catch(err) {
            handleError(err);
        }
    }

    onShowOrdersClick(e) {
        e.preventDefault();
        ipcRenderer.send('showOrders');
    }

    render() {

        const { state } = this;
        console.log('state', state);

        const { coins, depositCoin, refundAddress, receiveCoin, receiveAddress, receiveAmount, marketInfo, btcMarketInfo } = this.state;

        let receiveDollars;
        if(coins && receiveAmount && receiveAmount && btcMarketInfo && btcMarketInfo.pair) {
            receiveDollars = getDollarAmount(receiveAmount, btcMarketInfo).toFixed(2);
        } else if(receiveAmount && receiveCoin === 'BTC') {
            receiveDollars = fx(Number(receiveAmount)).from('BTC').to('USD').toFixed(2);
        } else {
            receiveDollars = '';
        }

        const enableSubmitButton = ( receiveAmount, receiveAddress, refundAddress) ? true : false;

        return (
            <div className={'container-fluid'}>
                <div className={'row'}>
                    <div className={'col-sm-12'}>
                        <div>
                            <button type={'button'} className={'btn btn-default pull-right'} style={styles.ordersButton} onClick={this.onShowOrdersClick}><span className={'icon icon-list'}></span></button>
                            <h2 style={styles.header} className={'text-center'}>Crypto Farm Exchanger</h2>
                        </div>
                    </div>
                </div>
                <div className={'row'}>
                    <div className={'col-sm-12'}>
                        <CoinSelector
                            coins={coins}
                            depositCoin={depositCoin}
                            receiveCoin={receiveCoin}
                            onDepositCoinChange={this.onDepositCoinChange}
                            onReceiveCoinChange={this.onReceiveCoinChange}
                            onSwitch={this.onCoinSwitch}
                        />
                    </div>
                </div>
                {coins.length > 0 ?
                    <div>
                        <ExchangeForm
                            coins={coins}
                            depositCoin={depositCoin}
                            receiveCoin={receiveCoin}
                            receiveAmount={receiveAmount}
                            receiveDollars={receiveDollars}
                            onReceiveAmountChange={this.onReceiveAmountChange}
                            receiveAddress={receiveAddress}
                            onReceiveAddressChange={this.onReceiveAddressChange}
                            refundAddress={refundAddress}
                            onRefundAddressChange={this.onRefundAddressChange}
                            marketInfo={marketInfo}
                        />
                        <div className={'row'}>
                            <div className={'col-sm-12'}>
                                <button type={'button'} className={'btn btn-success center-block'} disabled={enableSubmitButton ? false : true} onClick={this.onSubmit}>Submit Order</button>
                            </div>
                        </div>
                    </div>
                    :
                    <div></div>
                }
            </div>
        );
    }

}

(async function() {
    try {

        await new Promise((resolve, reject) => {
            shapeshift.isDown((err, isDown) => {
                if(err) {
                    reject(err);
                } else if(isDown) {
                    reject(new Error('Shapeshift.io is down. No exchanges can be processed at this time. Please try again later.'));
                } else {
                    resolve();
                }
            });
        });

        ReactDOM.render(
            <App />,
            document.getElementById('js-app')
        );
    } catch(err) {
        handleError(err);
    }
})();
