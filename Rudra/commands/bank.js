// === modules/commands/bank.js ===
const { setData, getData } = require("../../database.js");

module.exports.config = {
  name: "bank",
  version: "4.4.0",
  hasPermssion: 0,
  credits: "ChatGPT + Jaylord",
  description: "Bank system with Firebase persistence",
  commandCategory: "Economy",
  usages: "/bank, /bank all, /bank add <uid> <amount>",
  cooldowns: 3,
};

// 🔑 Bot admins
const BOT_ADMINS = ["61559999326713"];

// Format balance
function formatBalance(user, balance) {
  return `🏦 Bank Account 🏦\n\n👤 ${user}\n💰 Balance: ${balance.toLocaleString()} coins`;
}

// 🔹 Auto add coins per normal message
module.exports.handleEvent = async function ({ event, Users }) {
  const { senderID, body } = event;
  if (!senderID || !body) return;
  if (body.trim().startsWith("/")) return;

  let userData = await getData(`bank/${senderID}`);

  // ✅ Always fetch latest name
  let name;
  try {
    name = await Users.getNameUser(senderID);
  } catch {
    name = senderID;
  }

  if (!userData) {
    // wala pang account → create
    await setData(`bank/${senderID}`, {
      uid: senderID,
      name,
      balance: 5
    });
    return;
  }

  // meron na → dagdagan
  let balance = (userData.balance || 0) + 5;
  await setData(`bank/${senderID}`, {
    uid: senderID,
    name,
    balance
  });
};

// 🔹 Run command
module.exports.run = async function ({ api, event, args, Users }) {
  const { threadID, senderID } = event;
  const command = args[0] ? args[0].toLowerCase() : "";

  const validArgs = ["", "all", "add"];
  if (!validArgs.includes(command)) {
    return api.sendMessage(
      "❌ Invalid usage.\n\n" +
        "📌 Correct Usage:\n" +
        "• /bank → check your balance\n" +
        "• /bank all → show all balances\n" +
        "• /bank add <uid> <amount> → add coins (admin only)",
      threadID
    );
  }

  // 📋 Show all accounts
  if (command === "all") {
    const data = (await getData("bank")) || {};
    const accounts = [];

    for (const [uid, info] of Object.entries(data)) {
      let name;
      try {
        name = await Users.getNameUser(uid);
      } catch {
        name = info.name || uid;
      }

      // update name kung nag-iba
      if (info.name !== name) {
        await setData(`bank/${uid}`, {
          uid,
          name,
          balance: info.balance || 0
        });
      }

      accounts.push({
        uid,
        balance: info.balance || 0,
        name
      });
    }

    // sort by balance (desc)
    accounts.sort((a, b) => b.balance - a.balance);

    let msg = `📋 All Bank Accounts (Total: ${accounts.length}) 📋\n`;
    for (let i = 0; i < accounts.length; i++) {
      msg += `\n${i + 1}. ${accounts[i].name} - 💰 ${accounts[i].balance.toLocaleString()} coins`;
    }

    return api.sendMessage(msg, threadID);
  }

  // 🔑 Admin add coins
  if (command === "add") {
    if (!BOT_ADMINS.includes(senderID)) {
      return api.sendMessage("❌ Only bot admins can add coins.", threadID);
    }

    const targetUID = args[1];
    const amount = parseInt(args[2]);

    if (!targetUID || isNaN(amount) || amount <= 0) {
      return api.sendMessage("❌ Usage: /bank add <uid> <amount>", threadID);
    }

    let userData = await getData(`bank/${targetUID}`);

    let name;
    try {
      name = await Users.getNameUser(targetUID);
    } catch {
      name = targetUID;
    }

    if (!userData) {
      await setData(`bank/${targetUID}`, {
        uid: targetUID,
        name,
        balance: amount
      });

      return api.sendMessage(
        `✅ Created new account for ${name} with 💰 ${amount.toLocaleString()} coins.`,
        threadID
      );
    }

    // update balance
    let balance = (userData.balance || 0) + amount;
    await setData(`bank/${targetUID}`, {
      uid: targetUID,
      name,
      balance
    });

    return api.sendMessage(
      `✅ Added 💰 ${amount.toLocaleString()} coins to ${name}'s account.`,
      threadID
    );
  }

  // 📌 Default → show own balance
  let userData = await getData(`bank/${senderID}`);

  let name;
  try {
    name = await Users.getNameUser(senderID);
  } catch {
    name = senderID;
  }

  if (!userData) {
    await setData(`bank/${senderID}`, {
      uid: senderID,
      name,
      balance: 0
    });

    return api.sendMessage(formatBalance(name, 0), threadID);
  }

  // update name kung nag-iba
  if (userData.name !== name) {
    await setData(`bank/${senderID}`, {
      uid: senderID,
      name,
      balance: userData.balance || 0
    });
  }

  return api.sendMessage(formatBalance(name, userData.balance || 0), threadID);
};
