const { splitBill, burdenAmount } = require("./SplitBill");
const { localSearch } = require("./yolp");

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp(functions.config().firebase);

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(function (req, res, next) {
  console.log(`===== REQUEST START 【${req.method}】 ${req.originalUrl} =====`);
  console.log(`REQUEST PARAMS`);
  console.table(req.params);
  console.log(`REQUEST BODY`);
  console.table(req.body);
  next();
});

const fireStore = admin.firestore();
const database = admin.database();

const groupPayCollection = fireStore.collection("group-pay");
const settlementCount = fireStore.collection("settlement-count");
const settlementCollection = fireStore.collection("settlement");
const approveCollection = fireStore.collection("approve");

settlementCount.doc("count").set({ count: 0 });
database.ref("/active-group-pay").set(null);

const fetchSettlement = async (groupPayId) => {
  return (
    await settlementCollection.where("groupPayId", "==", groupPayId).get()
  ).docs.map((doc) => {
    return Object.assign(doc.data(), {
      id: doc.id,
    });
  });
};

const fetchGroupPay = async (doc) => {
  const settlement = await fetchSettlement(doc.id);
  return Object.assign(doc.data(), {
    id: doc.id,
    settlement,
    settlementAmount: splitBill(settlement),
    burdenAmount: burdenAmount(settlement),
  });
};

const updateActiveGroupPay = async () => {
  const querySnapshot = await groupPayCollection
    .where("active", "==", true)
    .limit(1)
    .get();
  const doc = querySnapshot.docs[0];

  const activeGroupPay = await fetchGroupPay(doc);

  database.ref("/active-group-pay").set(activeGroupPay);
  console.log(
    "=================== UPDATE ACTIVE GROUP PAY  ======================"
  );
};

app.get("/grouppay/", async (req, res) => {
  const querySnapshot = await groupPayCollection.get();
  const data = await Promise.all(querySnapshot.docs.map(fetchGroupPay));
  res.send(data);
});

app.get("/grouppay/:id/", async (req, res) => {
  const { id } = req.params;

  const doc = await groupPayCollection.doc(id).get();

  const data = await fetchGroupPay(doc);
  res.send(data);
});

app.post("/grouppay/", async (req, res) => {
  const { name, members, groupName } = req.body;

  const payload = {
    name,
    members,
    active: true,
    settlement: [],
    settlementAmount: [],
    groupName,
    createdAt: new Date().getTime(),
  };

  const doc = await groupPayCollection.add(payload);

  const uniqId = database.ref("/messages").push().key;

  const data = Object.assign(payload, {
    id: doc.id,
  });

  database.ref("/messages").child(uniqId).set({
    from: "BOT",
    type: "CREATE_GROUPPAY",
    data,
    timestamp: new Date().getTime(),
  });

  updateActiveGroupPay();

  res.send(data);
});

// 精算する
app.post("/grouppay/:id/calculate/", async (req, res) => {
  const { id } = req.params;

  const doc = await groupPayCollection.doc(id).get();

  const data = await fetchGroupPay(doc);

  if (data.calculate) {
    res.sendStatus(204);
  } else {
    data.calculate = true;
    await groupPayCollection.doc(id).set(data);

    const uniqId = database.ref("/messages").push().key;

    database.ref("/messages").child(uniqId).set({
      from: "BOT",
      type: "CALCULATE_START",
      data,
      timestamp: new Date().getTime(),
    });

    res.send();
  }
});

app.post("/grouppay/:id/approve/", async (req, res) => {
  const { id } = req.params;
  const { from } = req.body;

  await approveCollection.add({
    groupPayId: id,
    from,
  });

  const groupPay = (await groupPayCollection.doc(id).get()).data();
  const approveFromList = (
    await approveCollection.where("groupPayId", "==", id).get()
  ).docs
    .map((doc) => doc.data())
    .map((approve) => approve.from);

  if (
    groupPay.members.every((memberId) => approveFromList.includes(memberId))
  ) {
    await groupPayCollection.doc(id).update({
      active: false,
    });

    const doc = await groupPayCollection.doc(id).get();
    const updateGroupPay = await fetchGroupPay(doc);

    const uniqId = database.ref("/messages").push().key;

    database.ref("/messages").child(uniqId).set({
      from: "BOT",
      type: "CALCULATE_DONE",
      data: updateGroupPay,
      timestamp: new Date().getTime(),
    });

    updateActiveGroupPay();
  }

  res.send();
});

// 決済情報を追加する
app.post("/grouppay/:id/settlement/", async (req, res) => {
  const dummyData = [
    {
      id: "10",
      amount: 150000,
      storeName: "JR東京",
      storeImage:
        "https://res.cloudinary.com/ariaqua/image/upload/v1627723729/GroupPay/outline_train_black_48_scvx3a.png",
      owner: "memberId1",
      settlementAt: 12345,
      members: [
        "memberId1",
        "memberId2",
        "memberId3",
        "memberId4",
        "memberId5",
      ],
    },
    {
      id: "11",
      amount: 200000,
      storeName: "京都駅前ホテル",
      storeImage:
        "https://res.cloudinary.com/ariaqua/image/upload/v1627723729/GroupPay/outline_hotel_black_48_wvj0mr.png",
      owner: "memberId2",
      settlementAt: 12345,
      members: [
        "memberId1",
        "memberId2",
        "memberId3",
        "memberId4",
        "memberId5",
      ],
    },
    {
      id: "12",
      amount: 3500,
      storeName: "JR京都バス",
      storeImage:
        "https://res.cloudinary.com/ariaqua/image/upload/v1627723729/GroupPay/outline_directions_bus_black_48_qhehdk.png",
      owner: "memberId1",
      settlementAt: 12345,
      members: [
        "memberId1",
        "memberId2",
        "memberId3",
        "memberId4",
        "memberId5",
      ],
    },
    {
      id: "13",
      amount: 1500,
      storeName: "龍安寺",
      storeImage:
        "https://res.cloudinary.com/ariaqua/image/upload/v1627723729/GroupPay/outline_foundation_black_48_obvs8a.png",
      owner: "memberId1",
      settlementAt: 12345,
      members: [
        "memberId1",
        "memberId2",
        "memberId3",
        "memberId4",
        "memberId5",
      ],
    },
    {
      id: "14",
      amount: 4500,
      storeName: "八ツ橋",
      storeImage:
        "https://res.cloudinary.com/ariaqua/image/upload/v1627723729/GroupPay/outline_redeem_black_48_tfmvkv.png",
      owner: "memberId1",
      settlementAt: 12345,
      members: ["memberId1", "memberId4", "memberId5"],
    },
    {
      id: "15",
      amount: 1500,
      storeName: "金閣寺",
      storeImage:
        "https://res.cloudinary.com/ariaqua/image/upload/v1627723729/GroupPay/outline_foundation_black_48_obvs8a.png",
      owner: "memberId1",
      settlementAt: 12345,
      members: [
        "memberId1",
        "memberId2",
        "memberId3",
        "memberId4",
        "memberId5",
      ],
    },
    {
      id: "16",
      amount: 1500,
      storeName: "京都タクシー",
      storeImage:
        "https://res.cloudinary.com/ariaqua/image/upload/v1627723729/GroupPay/outline_local_taxi_black_48_r2jlhb.png",
      owner: "memberId1",
      settlementAt: 12345,
      members: [
        "memberId1",
        "memberId2",
        "memberId3",
        "memberId4",
        "memberId5",
      ],
    },
    {
      id: "17",
      amount: 25000,
      storeName: "京料理",
      storeImage:
        "https://res.cloudinary.com/ariaqua/image/upload/v1627723729/GroupPay/outline_food_bank_black_48_dcvjgx.png",
      owner: "memberId1",
      settlementAt: 12345,
      members: [
        "memberId1",
        "memberId2",
        "memberId3",
        "memberId4",
        "memberId5",
      ],
    },
    {
      id: "18",
      amount: 10000,
      storeName: "Bar Kyoto",
      storeImage:
        "https://res.cloudinary.com/ariaqua/image/upload/v1627723729/GroupPay/outline_liquor_black_48_sogyeb.png",
      owner: "memberId5",
      settlementAt: 12345,
      members: ["memberId4", "memberId5"],
    },
    {
      id: "19",
      amount: 1000,
      storeName: "京都タクシー",
      storeImage:
        "https://res.cloudinary.com/ariaqua/image/upload/v1627723729/GroupPay/outline_local_taxi_black_48_r2jlhb.png",
      owner: "memberId1",
      settlementAt: 12345,
      members: ["memberId1", "memberId2", "memberId3"],
    },
    {
      id: "20",
      amount: 1500,
      storeName: "京都深夜タクシー",
      storeImage:
        "https://res.cloudinary.com/ariaqua/image/upload/v1627723729/GroupPay/outline_local_taxi_black_48_r2jlhb.png",
      owner: "memberId5",
      settlementAt: 12345,
      members: ["memberId4", "memberId5"],
    },
  ];

  const { id } = req.params;

  const { count } = (await settlementCount.doc("count").get()).data();

  const index = count % dummyData.length;

  const data = Object.assign(dummyData[index], {
    settlementAt: new Date().getTime(),
    groupPayId: id,
  });

  const doc = await settlementCollection.add(data);

  await settlementCount.doc("count").set({
    count: count + 1,
  });

  const uniqId = database.ref("/messages").push().key;

  database
    .ref("/messages")
    .child(uniqId)
    .set({
      from: "BOT",
      type: "SETTLEMENT",
      data: Object.assign(data, {
        id: doc.id,
        groupPayId: id,
      }),
      timestamp: new Date().getTime(),
    });

  updateActiveGroupPay();

  res.send(
    Object.assign(data, {
      id: doc.id,
    })
  );
});

app.post("/settlement/:id/members/", async (req, res) => {
  const { id } = req.params;
  const { members } = req.body;

  const doc = await settlementCollection.doc(id).update({
    members,
  });

  updateActiveGroupPay();

  res.send(doc);
});

app.get("/sendmessage", (req, res) => {
  const { message } = req.body;
  const uniqId = database.ref("/messages").push().key;
  database
    .ref("/messages")
    .child(uniqId)
    .set({
      data: {
        message: message,
      },
      from: "memberId5",
      timestamp: new Date().getTime(),
      type: "TEXT",
    });

  res.send();
});

exports.api = functions.https.onRequest(app);

exports.localSearch = functions.database
  .ref("/messages")
  .onUpdate(async (change, context) => {
    const latestMessage = Object.values(change.after._data).reduce((p, c) =>
      p.timestamp > c.timestamp ? p : c
    );

    if (
      latestMessage.type === "TEXT" &&
      latestMessage.data.message.includes("@GroupPay")
    ) {
      const query = latestMessage.data.message
        .replace("@GroupPay", "")
        .trim()
        .split(" ")[0];

      const uniqId = database.ref("/messages").push().key;
      database
        .ref("/messages")
        .child(uniqId)
        .set({
          data: {
            featureList: await localSearch(query),
          },
          from: "BOT",
          timestamp: new Date().getTime(),
          type: "LOCAL_SEARCH",
        });
    }
  });
