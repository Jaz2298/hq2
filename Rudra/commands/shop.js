// Global Auto Poster (every 20 mins across all GCs)
const fs = require("fs");
const path = require("path");

// ==========================
// 📂 File Paths
// ==========================
const bankFile = path.join(__dirname, "bank.json");
const shopFile = path.join(__dirname, "shop.json");

// ==========================
// 🏦 BANK SYSTEM
// ==========================
function loadBank() {
  if (!fs.existsSync(bankFile)) fs.writeFileSync(bankFile, JSON.stringify({}, null, 2), "utf8");
  try {
    return JSON.parse(fs.readFileSync(bankFile, "utf8"));
  } catch {
    return {};
  }
}

function saveBank(data) {
  fs.writeFileSync(bankFile, JSON.stringify(data, null, 2), "utf8");
}

// ==========================
// 🛒 SHOP SYSTEM
// ==========================
function loadShop() {
  if (!fs.existsSync(shopFile)) fs.writeFileSync(shopFile, JSON.stringify({}, null, 2), "utf8");
  try {
    return JSON.parse(fs.readFileSync(shopFile, "utf8"));
  } catch {
    return {};
  }
}

function saveShop(data) {
  fs.writeFileSync(shopFile, JSON.stringify(data, null, 2), "utf8");
}

// ==========================
// ⏰ Date Formatter
// ==========================
function formatDate() {
  return new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
}

// ==========================
// 🔁 Auto Poster
// ==========================
let started = false;
module.exports.handleEvent = async function ({ api }) {
  if (started) return;
  started = true;

  setInterval(async () => {
    let bank = loadBank();
    let shopData = loadShop();

    // gumawa ng global sellers list (lahat ng GC)
    let globalSellers = [];
    for (const threadID of Object.keys(shopData)) {
      if (shopData[threadID]?.sellers) {
        shopData[threadID].sellers.forEach(s => {
          globalSellers.push({
            ...s,
            threadID
          });
        });
      }
    }

    // tanggalin lang yung nawalan ng coins
    let stillActive = [];
    let postMessage = `🛒 GLOBAL AUTO SHOP POST (Every 20 minutes) 🛒\n📢 This post is sent to all groups where the bot is a member!\n\n`;

    globalSellers.forEach(seller => {
      if (!bank[seller.seller] || bank[seller.seller].balance < 20) {
        // wala nang coins → tanggalin
        api.sendMessage(
          `⚠️ ${seller.name}, na-remove ka sa auto shop kasi naubusan ka ng coins.`,
          seller.threadID
        );
        return;
      }

      // bawas coins
      bank[seller.seller].balance -= 20;

      // add to post
      postMessage += `👤 Seller: ${seller.name}\n🔗 ${seller.fbLink}\n📦 Item: ${seller.details}\n💬 From: ${seller.threadName}\n💰 Balance: ${bank[seller.seller].balance.toLocaleString()} coins\n\n━━━━━━━━━━━━━━\n\n`;

      stillActive.push(seller);
    });

    if (stillActive.length > 0) {
      postMessage += `🕒 Updated: ${formatDate()}\n\n👉 Gusto mo rin ma-post ang items mo?\nType: /shop <details> (20 coins bawat 20 mins auto-post)\n\n📖 Type /help para makita ang lahat ng command\n\n👉 𝗝𝗼𝗶𝗻 𝗼𝘂𝗿 𝗚𝗮𝗴 𝗕𝘂𝘆 𝗮𝗻𝗱 𝗦𝗲𝗹𝗹 𝗚𝗖:\nhttps://m.me/j/AbYBqABSq7cyHsBk/`;

      // ipadala sa lahat ng GC kung saan naka join ang bot
      for (const threadID of Object.keys(shopData)) {
        api.sendMessage(postMessage, threadID);
      }
    }

    // i-update lang yung active sellers
    let newShopData = {};
    stillActive.forEach(seller => {
      if (!newShopData[seller.threadID]) newShopData[seller.threadID] = { sellers: [] };
      newShopData[seller.threadID].sellers.push(seller);
    });

    saveShop(newShopData);
    saveBank(bank);
  }, 20 * 60 * 1000); // every 20 mins
};
