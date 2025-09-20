const { setData, getData } = require("../../database.js");

module.exports.config = {
  name: "petredeem",
  version: "1.1.0",
  hasPermision: 1, // admin only for adding pets
  description: "Add pets and redeem using coins",
  usages: "/petredeem add <name> <age> <weight> <price>\n/petredeem\n/petredeem <number>",
  commandCategory: "economy",
};

function generateCode(length = 8) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

module.exports.run = async function({ api, event, args }) {
  const { threadID, senderID, messageID } = event;

  const petsData = (await getData(`petredeem/${threadID}/pets`)) || [];

  // ---------------- ADD PET ----------------
  if (args[0]?.toLowerCase() === "add") {
    if (!args[1] || !args[2] || !args[3] || !args[4]) {
      return api.sendMessage(
        "❌ Usage: /petredeem add <name> <age> <weight> <price>",
        threadID,
        messageID
      );
    }

    const name = args.slice(1, -3).join(" ");
    const age = parseInt(args[args.length - 3]);
    const weight = parseFloat(args[args.length - 2]);
    const price = parseInt(args[args.length - 1]);

    if (isNaN(age) || isNaN(weight) || isNaN(price)) {
      return api.sendMessage("❌ Age, weight, and price must be numbers.", threadID, messageID);
    }

    petsData.push({ name, age, weight, price });
    await setData(`petredeem/${threadID}/pets`, petsData);

    return api.sendMessage(
      `✅ Successfully added pet!\n\n🐾 Name: ${name}\n🎂 Age: ${age} years\n⚖️ Weight: ${weight} kg\n💰 Price: ${price} coins`,
      threadID,
      messageID
    );
  }

  // ---------------- LIST PETS ----------------
  if (!args[0]) {
    if (petsData.length === 0) return api.sendMessage("📋 No pets available for redemption.", threadID, messageID);

    let msg = "📋 **Available Pets for Redemption** 📋\n\n";
    petsData.forEach((pet, i) => {
      msg += `✨ ${i + 1}. ${pet.name}\n` +
             `   🎂 Age: ${pet.age} years\n` +
             `   ⚖️ Weight: ${pet.weight} kg\n` +
             `   💰 Price: ${pet.price} coins\n\n`;
    });
    msg += "💡 Use `/petredeem <number>` to redeem a pet!";
    return api.sendMessage(msg, threadID, messageID);
  }

  // ---------------- REDEEM PET ----------------
  const index = parseInt(args[0]);
  if (isNaN(index) || index < 1 || index > petsData.length) {
    return api.sendMessage("❌ Invalid selection. Please use the number of the pet from the list.", threadID, messageID);
  }

  const pet = petsData[index - 1];

  // Load user coins
  let bankData = (await getData(`bank/${threadID}/${senderID}`)) || { balance: 0 };
  if (bankData.balance < pet.price) {
    return api.sendMessage(`❌ You need ${pet.price} coins to redeem this pet.\n💰 Your balance: ${bankData.balance} coins`, threadID, messageID);
  }

  bankData.balance -= pet.price;
  await setData(`bank/${threadID}/${senderID}`, bankData);

  // Generate code
  const code = generateCode();
  const codes = (await getData(`petredeem/${threadID}/codes`)) || {};
  codes[code] = { petName: pet.name, userID: senderID, used: false };
  await setData(`petredeem/${threadID}/codes`, codes);

  return api.sendMessage(
    `🎉 Successfully redeemed your pet!\n\n🐾 Name: ${pet.name}\n🎂 Age: ${pet.age} years\n⚖️ Weight: ${pet.weight} kg\n` +
    `🔑 Your code: ${code}\n💰 Remaining balance: ${bankData.balance} coins`,
    threadID,
    messageID
  );
};
