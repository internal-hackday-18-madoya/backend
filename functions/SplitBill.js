const _ = require("lodash");

const splitBill = (settlementList) => {
  const cashFlow = []
    .concat(...settlementList.map(toCashFlow))
    .filter((flow) => flow.to != "STORE");
  const c = _.mapValues(_.groupBy(cashFlow, "from"), (values) => {
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

const burdenAmount = (settlementList) => {
  const cashFlow = [].concat(...settlementList.map(toCashFlow));
  const c = _.mapValues(_.groupBy(cashFlow, "from"), (values) => {
    return _.mapValues(_.groupBy(values, "to"), (values2) => {
      return values2.reduce((p, c) => p + c.amount, 0);
    });
  });

  console.log(JSON.stringify(c));
  return Object.keys(c).map((key) => {
    return {
      memberId: key,
      paymentAmounts: Object.values(c[key]).reduce((p, c) => p + c, 0) * -1,
    };
  });
};

const toCashFlow = (settlement) => {
  const owner = settlement.owner;
  const amount = Math.floor(settlement.amount / settlement.members.length);

  let send = settlement.members
    .filter((memberId) => memberId != owner)
    .map((memberId) => {
      return {
        from: memberId,
        to: owner,
        amount: amount * -1,
      };
    });

  let receive = settlement.members
    .filter((memberId) => memberId != owner)
    .map((memberId) => {
      return {
        from: owner,
        to: memberId,
        amount: amount * 1,
      };
    });

  let shop = {
    from: owner,
    to: "STORE",
    amount: settlement.amount * -1,
  };

  return [].concat(send, receive, [shop]);
};

const settlementList = [
  { owner: "A", members: ["A", "B", "C"], amount: 1000 },
  { owner: "B", members: ["B", "C"], amount: 2000 },
];

console.log("=======================================");
// console.log(JSON.stringify(splitBill(settlementList), null, 2));
console.log("=======================================");
console.log(JSON.stringify(burdenAmount(settlementList), null, 2));
console.log("=======================================");

module.exports = {
  splitBill,
  burdenAmount,
};
