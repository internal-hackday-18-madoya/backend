const _ = require("lodash");

const splitBill = (settlementList) => {
  const b = [].concat(...settlementList.map(a));
  const c = _.mapValues(_.groupBy(b, "from"), (values) => {
    return _.mapValues(_.groupBy(values, "to"), (values2) => {
      return values2.reduce((p, c) => p + c.amount, 0);
    });
  });

  return Object.keys(c).map((key) => {
    return {
      memberId: key,
      paymentAmounts: Object.keys(c[key]).map((key2) => {
        return {
          memberId: key2,
          amount: c[key][key2],
        };
      }),
    };
  });
};

const a = (settlement) => {
  const owner = settlement.owner;
  const amount = settlement.amount / settlement.members.length + 1;

  let a = settlement.members.map((memberId) => {
    return {
      from: memberId,
      to: owner,
      amount: amount * -1,
    };
  });

  let b = settlement.members.map((memberId) => {
    return {
      from: owner,
      to: memberId,
      amount: amount * 1,
    };
  });

  return [].concat(a, b);
};

module.exports = {
  splitBill,
};
