import PropTypes from 'prop-types';
import React from 'react';

const styles = {
    well: {
        paddingTop: 5,
        paddingBottom: 5,
        paddingLeft: 5,
        paddingRight: 5
    },
    flexContainer: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-start',
        flexWrap: 'nowrap'
    },
    depositColumn: {
        flexGrow: 2,
        flexBasis: 0,
        margin: 5
    },
    centerColumn: {
        flexGrow: 1,
        flexBasis: 0,
        margin: 5,
        paddingTop: 60
    },
    receiveColumn: {
        flexGrow: 2,
        flexBasis: 0,
        margin: 5
    },
    switchIcon: {
        lineHeight: '32px',
        fontSize: 20
    },
    coinImage: {
        width: 50,
        height: 50,
        marginBottom: 10
    }
};

const CoinSelector = ({ depositCoin, receiveCoin, coins, onDepositCoinChange, onReceiveCoinChange, onSwitch }) => {

    const onSwitchClick = e => {
        e.preventDefault();
        onSwitch();
    };

    const depositCoinObject = coins.find(c => c.symbol === depositCoin) || {};
    const receiveCoinObject = coins.find(c => c.symbol === receiveCoin) || {};

    return (
        <div style={styles.well} className={'well'}>
            <div style={styles.flexContainer}>
                <div style={styles.depositColumn}>
                    <div>
                        {depositCoinObject.image ?
                            <img className={'center-block'} src={depositCoinObject.image} style={styles.coinImage}></img>
                            :
                            <div style={styles.coinImage}></div>
                        }
                    </div>
                    <div>
                        <select className={'form-control'} value={depositCoin} onChange={e => onDepositCoinChange(e.target.value)}>
                            {
                                coins
                                    .filter(c => c.symbol !== receiveCoin)
                                    .map(c => <option key={c.symbol} value={c.symbol}>{`${c.symbol} - ${c.name}`}</option>)
                            }
                        </select>
                    </div>
                </div>
                <div style={styles.centerColumn}>
                    <div className={'text-center'}>
                        <a href={'#'} onClick={onSwitchClick}><span style={styles.switchIcon} className={'glyphicon glyphicon-retweet'}></span></a>
                    </div>
                </div>
                <div style={styles.receiveColumn}>
                    <div>
                        {receiveCoinObject.image ?
                            <img className={'center-block'} src={receiveCoinObject.image} style={styles.coinImage}></img>
                            :
                            <div style={styles.coinImage}></div>
                        }
                    </div>
                    <div>
                        <select className={'form-control'} value={receiveCoin} onChange={e => onReceiveCoinChange(e.target.value)}>
                            {
                                coins
                                    .filter(c => c.symbol !== depositCoin)
                                    .map(c => <option key={c.symbol} value={c.symbol}>{`${c.symbol} - ${c.name}`}</option>)
                            }
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};
CoinSelector.propTypes = {
    depositCoin: PropTypes.string,
    receiveCoin: PropTypes.string,
    coins: PropTypes.arrayOf(PropTypes.object),
    onDepositCoinChange: PropTypes.func,
    onReceiveCoinChange: PropTypes.func,
    onSwitch: PropTypes.func
};

export default CoinSelector;
