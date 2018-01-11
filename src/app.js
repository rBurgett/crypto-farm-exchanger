import fx from 'money';
import oxr from 'open-exchange-rates';
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import shapeshift from 'shapeshift.io';
import swal from 'sweetalert';
import { bindAll } from 'lodash';

import CoinSelector from './components/coin-selector';

oxr.set({ app_id: process.env.EXCHANGE_KEY });

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

class App extends Component {

    constructor(props) {
        super(props);
        this.state = {
            depositCoin: '',
            receiveCoin: '',
            coins: []
        };
        bindAll(this, [
            'onDepositCoinChange',
            'onReceiveCoinChange',
            'onCoinSwitch'
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
            this.setState({
                ...this.state,
                coins: coinsArr,
                depositCoin,
                receiveCoin
            });

            await updateRates();

            // update the exchange rates every fifteen minutes
            setInterval(() => updateRates(), 60 * 15 * 1000);

        } catch(err) {
            handleError(err);
        }
    }

    onDepositCoinChange(coin) {
        this.setState({
            ...this.state,
            depositCoin: coin
        });
    }

    onReceiveCoinChange(coin) {
        this.setState({
            ...this.state,
            receiveCoin: coin
        });
    }

    onCoinSwitch() {
        const { state } = this;
        this.setState({
            ...state,
            depositCoin: state.receiveCoin,
            receiveCoin: state.depositCoin
        });
    }

    render() {

        const { state } = this;
        console.log('state', state);

        const { coins, depositCoin, receiveCoin } = this.state;

        return (
            <div className={'container-fluid'}>
                <div className={'row'}>
                    <div className={'col-sm-12'}>
                        <h2 className={'text-center'}>Crypto Farm Exchanger</h2>
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
