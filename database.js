const { getData, setData, updateData, deleteData } = require("../../database.js");

function pollText(poll) {
  const remaining = poll.end - Date.now();
  if (remaining <= 0) return `❌ Poll ended.`;

  const m = Math.floor((remaining / 60000) % 60);
  const h = Math.floor((remaining / 3600000) % 24);
  const d = Math.floor(remaining / 86400000);

  return (
`📊 ┃ Active User Poll ┃ 📊
─────────────────────────────
⏳ Ends in: ${d}d ${h}h ${m}m
📅 Deadline: ${new Date(poll.end).toLocaleString()}
─────────────────────────────
✅ Reply "active" to stay in the GC
⚠️ Non-active will be auto-kicked!
─────────────────────────────
👥 Active: ${poll.activeUsers.length}/${poll.totalUsers.length}`
  );
}

function cleanPoll(poll) {
  return {
    start: poll.start,
    end: poll.end,
    activeUsers: Array.isArray(poll.activeUsers) ? poll.activeUsers : [],
    totalUsers: Array.isArray(poll.totalUsers) ? poll.totalUsers : [],
    postID: poll.postID || null,
    ended: poll.ended || false
  };
}

async function endPoll(api, threadID, poll) {
  try {
    if (poll.ended) return;
    poll.ended = true;

    const threadInfo = await api.getThreadInfo(threadID);
    const adminIDs = threadInfo.adminIDs.map(a => a.id);

    const inactive = poll.totalUsers.filter(
      u => !poll.activeUsers.includes(u) && 
           u !== api.getCurrentUserID() && 
           !adminIDs.includes(u)
    );

    for (const uid of inactive) {
      try {
        await api.removeUserFromGroup(uid, threadID);
      } catch (e) {
        console.log("Kick failed:", uid);
      }
    }

    if (poll.postID) api.unsendMessage(poll.postID, ()=>{});

    api.sendMessage(
      `✅ Poll Ended!\n👥 Active: ${poll.activeUsers.length}\n🚫 Kicked: ${inactive.length}`,
      threadID
    );

    await deleteData(`/cleaners/${threadID}`);
  } catch (err) {
    console.error("endPoll error:", err);
  }
}

module.exports.config = {
  name: "cleaner",
  version: "4.5.0",
  hasPermssion: 1,
  credits: "NN + ChatGPT",
  description: "Active user poll with auto kick",
  commandCategory: "system",
  usages: "/cleaner <time> | list | resend | cancel",
  cooldowns: 5,
};

module.exports.run = async function ({ api, event, args }) {
  try {
    const { threadID, messageID } = event;
    const sub = args[0]?.toLowerCase();

    let poll = await getData(`/cleaners/${threadID}`);

    // auto-clean expired poll
    if (poll && poll.end <= Date.now()) {
      await deleteData(`/cleaners/${threadID}`);
      poll = null;
    }

    // start
    if (sub && !["list", "resend", "cancel"].includes(sub)) {
      if (poll) return api.sendMessage("⚠️ May active poll pa sa GC na ito.", threadID, messageID);

      const match = sub.match(/^(\d+)([mhd])$/i);
      if (!match) return api.sendMessage("❌ Example: /cleaner 5m | 2h | 1d", threadID, messageID);

      const num = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      let duration = unit === "m" ? num*60000 : unit==="h" ? num*3600000 : num*86400000;

      const members = (await api.getThreadInfo(threadID)).participantIDs;

      poll = {
        start: Date.now(),
        end: Date.now() + duration,
        activeUsers: [],
        totalUsers: members,
        postID: null,
        ended: false,
      };

      api.sendMessage(pollText(poll), threadID, async (err, info) => {
        if (!err) {
          poll.postID = info.messageID;
          await setData(`/cleaners/${threadID}`, cleanPoll(poll));
          setTimeout(() => endPoll(api, threadID, poll), duration);
        }
      });
      return;
    }

    // list
    if (sub === "list") {
      if (!poll) return api.sendMessage("⚠️ Walang active poll.", threadID, messageID);
      return api.sendMessage(`📋 Active (${poll.activeUsers.length}):\n${poll.activeUsers.join(", ")||"None"}`, threadID);
    }

    // resend
    if (sub === "resend") {
      if (!poll) return api.sendMessage("⚠️ Walang active poll.", threadID, messageID);
      if (poll.postID) api.unsendMessage(poll.postID, ()=>{});
      api.sendMessage(pollText(poll), threadID, async (err, info) => {
        if (!err) {
          poll.postID = info.messageID;
          await updateData(`/cleaners/${threadID}`, { postID: poll.postID });
        }
      });
      return;
    }

    // cancel
    if (sub === "cancel") {
      if (!poll) return api.sendMessage("⚠️ Walang active poll.", threadID, messageID);
      if (poll.postID) api.unsendMessage(poll.postID, ()=>{});
      await deleteData(`/cleaners/${threadID}`);
      return api.sendMessage("❌ Poll cancelled and removed.", threadID);
    }
  } catch (err) {
    console.error("Cleaner run error:", err);
  }
};

module.exports.handleEvent = async function ({ api, event }) {
  try {
    const { threadID, senderID, body, messageReply } = event;
    if (!body || !messageReply) return;

    const poll = await getData(`/cleaners/${threadID}`);
    if (!poll || poll.ended) return;
    if (messageReply.messageID !== poll.postID) return;
    if (body.trim().toLowerCase() !== "active") return;

    // 🔧 ensure array safety
    if (!Array.isArray(poll.activeUsers)) poll.activeUsers = [];

    if (!poll.activeUsers.includes(senderID)) {
      poll.activeUsers.push(senderID);

      if (poll.postID) api.unsendMessage(poll.postID, ()=>{});
      api.sendMessage(pollText(poll), threadID, async (err, info) => {
        if (!err) {
          poll.postID = info.messageID;
          await setData(`/cleaners/${threadID}`, cleanPoll(poll));
        }
      });
    } else {
      api.sendMessage("✅ Nakaregister ka na bilang active.", threadID);
    }
  } catch (err) {
    console.error("Cleaner handleEvent error:", err);
  }
};
