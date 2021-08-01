const { splitBill } = require("./SplitBill");

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp(functions.config().firebase);

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
  });
};

app.get("/grouppay/", async (req, res) => {
  const querySnapshot = await groupPayCollection.get();
  const data = await Promise.all(querySnapshot.docs.map(fetchGroupPay));
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

  database.ref("/active-group-pay").set(data);

  res.send(data);
});

// 精算する
app.post("/grouppay/:id/calculate/", async (req, res) => {
  const { id } = req.params;

  const doc = await groupPayCollection.doc(id).get();

  const settlement = await fetchSettlement(doc.id);
  const data = Object.assign(doc.data(), {
    id: doc.id,
    settlement,
    settlementAmount: splitBill(settlement),
  });

  const uniqId = database.ref("/messages").push().key;

  database.ref("/messages").child(uniqId).set({
    from: "BOT",
    type: "CALCULATE_START",
    data,
    timestamp: new Date().getTime(),
  });

  res.send({});
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
    const updateGroupPay = fetchGroupPay(doc);

    const uniqId = database.ref("/messages").push().key;

    database.ref("/messages").child(uniqId).set({
      from: "BOT",
      type: "CALCULATE_DONE",
      data: updateGroupPay,
      timestamp: new Date().getTime(),
    });

    database.ref("/active-group-pay").set(updateGroupPay);
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
      }),
      timestamp: new Date().getTime(),
    });

  (async () => {
    const doc = await groupPayCollection.doc(id).get();
    const updateGroupPay = await fetchGroupPay(doc);
    console.log("=============================", updateGroupPay);
    database.ref("/active-group-pay").set(updateGroupPay);
  })();

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

  (async () => {
    const groupPayId = (await settlementCollection.doc(id).get()).data()
      .groupPayId;
    const doc = await groupPayCollection.doc(groupPayId).get();
    const groupPay = fetchGroupPay(doc);

    database.ref("/active-group-pay").set(groupPay);
  })();

  res.send(doc);
});

exports.api = functions.https.onRequest(app);
