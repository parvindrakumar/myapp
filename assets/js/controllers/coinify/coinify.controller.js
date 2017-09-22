angular
  .module('walletApp')
  .controller('CoinifyController', CoinifyController);

function CoinifyController ($rootScope, $scope, $q, MyWallet, Wallet, Alerts, currency, $uibModalInstance, quote, trade, formatTrade, $timeout, $interval, coinify, $state, buyMobile, Env) {
  Env.then(env => {
    this.qaDebugger = env.qaDebugger;
  });

  let exchange = coinify.exchange;

  this.quote = quote;
  this.trade = trade;
  this.user = Wallet.user;
  this.now = () => new Date().getTime();
  this.exchange = exchange && exchange.profile ? exchange : {profile: {}};
  this.message = 'RATE_GUARANTEED';
  this.baseFiat = () => !currency.isBitCurrency({code: this.quote.baseCurrency});
  this.BTCAmount = () => !this.baseFiat() ? this.quote.baseAmount : this.quote.quoteAmount;
  this.fiatAmount = () => this.baseFiat() ? this.quote.baseAmount : this.quote.quoteAmount;
  this.fiatCurrency = () => this.baseFiat() ? this.quote.baseCurrency : this.quote.quoteCurrency;
  this.timeToExpiration = () => this.quote ? this.quote.expiresAt - this.now() : this.trade.expiresAt - this.now();
  this.refreshQuote = () => {
    if (this.baseFiat()) return $q.resolve(coinify.getQuote(this.quote.baseAmount * 100, this.quote.baseCurrency)).then((q) => this.quote = q);
    else return $q.resolve(coinify.getQuote(this.quote.baseAmount / 100000000, this.quote.baseCurrency, this.quote.quoteCurrency)).then((q) => this.quote = q);
  };
  this.expireTrade = () => {
    return $q.resolve(this.state.trade.expired = true);
  };

  this.cancel = () => {
    $uibModalInstance.dismiss('');
    $rootScope.$broadcast('fetchExchangeProfile');
    this.trade && this.trade.sendAmount && coinify.getTrades().then($scope.goToOrderHistory());
  };

  let links;
  Env.then(env => {
    links = env.partners.coinify.surveyLinks;
  });

  this.close = (idx) => {
    if (idx > links.length - 1) { this.cancel(); return; }
    Alerts.surveyCloseConfirm('buy-survey-opened', links, idx).then(this.cancel);
    coinify.incrementBuyDropoff(this.currentStep());
  };

  this.state = {
    email: {
      valid: true
    },
    trade: {
      expired: this.trade && this.trade.expiresAt - this.now() < 1
    }
  };

  this.onEmailChange = (valid) => {
    this.state.email.valid = valid;
  };

  this.onSignupComplete = () => {
    return $q.resolve(exchange.fetchProfile())
             .then(this.refreshQuote).then((q) => {
               this.quote = q;
               return q;
             })
             .then((quote) => {
               $q.resolve(quote.getPaymentMediums()).then(mediums => {
                 coinify.getLimits(mediums, this.fiatCurrency());
               })
               .then(() => this.goTo('select-payment-medium'));
             });
  };

  $scope.exitToNativeTx = () => {
    buyMobile.callMobileInterface(buyMobile.SHOW_TX, this.trade.txHash);
  };

  $scope.getQuoteHelper = () => {
    if (this.quote && !this.quote.id) return 'EST_QUOTE_1';
    else if (this.quote) return 'AUTO_REFRESH';
    else if (this.state.trade.expired) return 'EST_QUOTE_2';
    else if (this.trade) return 'RATE_WILL_EXPIRE';
    else return 'RATE_WILL_EXPIRE';
  };

  $scope.goToOrderHistory = () => {
    this.onStep('isx') && $state.go('wallet.common.buy-sell.coinify', {selectedTab: 'ORDER_HISTORY'});
  };

  this.steps = {
    'email': 0,
    'signup': 1,
    'select-payment-medium': 2,
    'summary': 3,
    'isx': 5,
    'trade-complete': 6
  };

  this.onStep = (...steps) => steps.some(s => this.step === this.steps[s]);
  this.currentStep = () => Object.keys(this.steps).filter(this.onStep)[0];
  this.goTo = (step) => this.step = this.steps[step];

  if (!this.user.isEmailVerified && !this.exchange.user) {
    this.goTo('email');
  } else if (!this.exchange.user) {
    this.goTo('signup');
  } else if (!this.trade) {
    this.goTo('select-payment-medium');
  } else if (!coinify.tradeStateIn(coinify.states.completed)(this.trade) && this.trade.medium !== 'bank') {
    this.goTo('isx');
  } else {
    this.goTo('trade-complete');
  }
}
