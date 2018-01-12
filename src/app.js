import fx from 'money';
import moment from 'moment';
import oxr from 'open-exchange-rates';
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import shapeshift from 'shapeshift.io';
import swal from 'sweetalert';
import { bindAll } from 'lodash';
import { ipcRenderer } from 'electron';

import CoinSelector from './components/coin-selector';
import ExchangeForm from './components/exchange-form';

oxr.set({ app_id: process.env.EXCHANGE_KEY });

const handleError = err => {
    console.error(err);
    swal('Oops!', err.message, 'error');
};

window.fx = fx;

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
            orders: []
        };
        bindAll(this, [
            'onDepositCoinChange',
            'onReceiveCoinChange',
            'onCoinSwitch',
            'onReceiveAmountChange',
            'onReceiveAddressChange',
            'onRefundAddressChange',
            'onSubmit'
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

        } catch(err) {
            handleError(err);
        }
    }

    async onDepositCoinChange(coin) {
        const { receiveCoin } = this.state;
        this.setState({
            ...this.state,
            depositCoin: coin
        });
        const [ marketInfo, btcMarketInfo ] = await getMarketInfo(coin, receiveCoin);
        this.setState({
            ...this.state,
            marketInfo,
            btcMarketInfo
        });
    }

    async onReceiveCoinChange(coin) {
        const { depositCoin } = this.state;
        this.setState({
            ...this.state,
            receiveCoin: coin
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
        const { depositCoin, receiveCoin } = state;
        this.setState({
            ...state,
            depositCoin: receiveCoin,
            receiveCoin: depositCoin
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
            const { receiveCoin, depositCoin, receiveAmount, receiveAddress, refundAddress } = this.state;
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

        } catch(err) {
            handleError(err);
        }
    }

    render() {

        const { state } = this;
        console.log('state', state);

        const { coins, depositCoin, refundAddress, receiveCoin, receiveAddress, receiveAmount, marketInfo, btcMarketInfo } = this.state;

        let receiveDollars;
        if(coins && receiveAmount && receiveAmount && btcMarketInfo && btcMarketInfo.pair) {
            receiveDollars = getDollarAmount(receiveAmount, btcMarketInfo).toFixed(2);
        } else if(receiveCoin === 'BTC') {
            receiveDollars = fx(Number(receiveAmount)).from('BTC').to('USD').toFixed(2);
        } else {
            receiveDollars = '';
        }

        const enableSubmitButton = ( receiveAmount, receiveAddress, refundAddress) ? true : false;

        return (
            <div className={'container-fluid'}>
                <div className={'row'}>
                    <div className={'col-sm-12'}>
                        <h2 style={styles.header} className={'text-center'}>Crypto Farm Exchanger</h2>
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
