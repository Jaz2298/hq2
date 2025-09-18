const { getData, setData, updateData, deleteData } = require("../../database.js");

// format poll UI
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

// sanitize object
function cleanPoll(poll) {
  return {
    start: poll.start,
    end: poll.end,
    activeUsers: poll.activeUsers,
    totalUsers: poll.totalUsers,
    postID: poll.postID,
    ended: poll.ended
  };
}

// end poll logic
async function endPoll(api, threadID, poll) {
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
      console.log("Kick failed:", uid, e.error || e);
    }
  }

  if (poll.postID) api.unsendMessage(poll.postID, () => {});

  api.sendMessage(
    `✅ Poll Ended!\n👥 Active: ${poll.activeUsers.length}\n🚫 Kicked: ${inactive.length}`,
    threadID
  );

  await deleteData(`/cleaners/${threadID}`);
}

module.exports.config = {
  name: "cleaner",
  version: "4.3.0",
  hasPermssion: 1,
  credits: "ChatGPT + NN",
  description: "Active user poll with auto kick on deadline (DB)",
  commandCategory: "system",
  usages: "/cleaner <time> | list | resend | cancel",
  cooldowns: 5,
};

module.exports.run = async function ({ api, event, args }) {
  const { threadID, messageID } = event;
  const sub = args[0]?.toLowerCase();

  let poll = await getData(`/cleaners/${threadID}`);

  // start new poll
  if (sub && !["list", "resend", "cancel"].includes(sub)) {
    if (poll) return api.sendMessage("⚠️ May active poll pa sa GC na ito.", threadID, messageID);

    const match = sub.match(/^(\d+)([mhd])$/i);
    if (!match) return api.sendMessage("❌ Invalid format. Example: /cleaner 5m | 2h | 1d", threadID, messageID);

    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    let duration = 0;
    if (unit === "m") duration = num * 60000;
    if (unit === "h") duration = num * 3600000;
    if (unit === "d") duration = num * 86400000;

    const threadInfo = await api.getThreadInfo(threadID);
    const members = threadInfo.participantIDs;

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

        // auto-end (hindi sine-save para maiwasan reset)
        setTimeout(() => endPoll(api, threadID, poll), duration);
      }
    });

    return;
  }

  // list
  if (sub === "list") {
    if (!poll) return api.sendMessage("⚠️ Walang active poll.", threadID, messageID);
    return api.sendMessage(
      `📋 Active Voters (${poll.activeUsers.length}):\n${poll.activeUsers.join(", ") || "None"}`,
      threadID
    );
  }

  // resend
  if (sub === "resend") {
    if (!poll) return api.sendMessage("⚠️ Walang active poll.", threadID, messageID);
    if (poll.postID) api.unsendMessage(poll.postID, () => {});
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
    poll.ended = true;
    if (poll.postID) api.unsendMessage(poll.postID, () => {});
    await deleteData(`/cleaners/${threadID}`);
    return api.sendMessage("❌ Poll has been cancelled.", threadID);
  }
};

// handle replies
module.exports.handleEvent = async function ({ api, event, Users }) {
  const { threadID, senderID, body, messageReply, messageID } = event;
  if (!body || !messageReply) return;

  const poll = await getData(`/cleaners/${threadID}`);
  if (!poll || poll.ended) return;

  // dapat reply mismo sa poll
  if (messageReply.messageID !== poll.postID) return;
  if (body.trim().toLowerCase() !== "active") return;

  const name = await Users.getNameUser(senderID);

  if (poll.activeUsers.includes(senderID)) {
    return api.sendMessage(
      `✅ ${name}, you are already marked as active.`,
      threadID,
      messageID
    );
  }

  // idagdag as active
  poll.activeUsers.push(senderID);

  // notify new active
  api.sendMessage(`🟢 ${name} is now marked as active!`, threadID);

  // delete luma at send updated poll
  if (poll.postID) api.unsendMessage(poll.postID, () => {});
  api.sendMessage(pollText(poll), threadID, async (err, info) => {
    if (!err) {
      poll.postID = info.messageID;
      await setData(`/cleaners/${threadID}`, cleanPoll(poll));
    }
  });
};
