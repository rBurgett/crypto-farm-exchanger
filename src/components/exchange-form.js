import React from 'react';
import PropTypes from 'prop-types';

const ExchangeForm = ({ coins, depositCoin, receiveCoin, receiveAmount, receiveDollars, onReceiveAmountChange, receiveAddress, onReceiveAddressChange, refundAddress, onRefundAddressChange }) => {

    const depositCoinObj = coins.find(c => c.symbol === depositCoin);
    const receiveCoinObj = coins.find(c => c.symbol === receiveCoin);
    const receiveAmountChanged = e => {
        e.preventDefault();
        onReceiveAmountChange(e.target.value.replace(/[^\d.]/g, ''));
    };

    const styles = {
        receiveLabelNote: {
            display: receiveDollars ? 'inline' : 'none',
            fontWeight: 'normal',
            fontStyle: 'italic'
        },
        labelNote: {
            fontWeight: 'normal',
            fontStyle: 'italic'
        }
    };

    return (
        <div>
            <div className={'row'}>
                <div className={'col-sm-12'}>
                    <div className={'form-group'}>
                        <label>{`How much ${receiveCoinObj.name} do you want to receive?`} <span className={'text-muted'} style={styles.receiveLabelNote}>{`(approx. $${receiveDollars})`}</span></label>
                        <input type={'text'} className={'form-control text-center'} value={receiveAmount} onChange={receiveAmountChanged} />
                    </div>
                </div>
            </div>
            <div className={'row'}>
                <div className={'col-sm-12'}>
                    <div className={'form-group'}>
                        <label>{`Your ${receiveCoinObj.name} address:`}</label>
                        <input type={'text'} className={'form-control text-center'} value={receiveAddress} onChange={e => onReceiveAddressChange(e.target.value)} />
                    </div>
                </div>
            </div>
            <div className={'row'}>
                <div className={'col-sm-12'}>
                    <div className={'form-group'}>
                        <label>{`Your ${depositCoinObj.name} refund address:`} <span className={'text-muted'} style={styles.labelNote}>(in case there is a problem during the exchange)</span></label>
                        <input type={'text'} className={'form-control text-center'} value={refundAddress} onChange={e => onRefundAddressChange(e.target.value)} />
                    </div>
                </div>
            </div>
        </div>
    );
};
ExchangeForm.propTypes = {
    depositCoin: PropTypes.string,
    receiveCoin: PropTypes.string,
    coins: PropTypes.arrayOf(PropTypes.object),
    receiveAmount: PropTypes.string,
    receiveDollars: PropTypes.string,
    receiveAddress: PropTypes.string,
    refundAddress: PropTypes.string,
    onReceiveAmountChange: PropTypes.func,
    onReceiveAddressChange: PropTypes.func,
    onRefundAddressAddressChange: PropTypes.func
};

export default ExchangeForm;
