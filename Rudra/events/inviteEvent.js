const { setData, getData } = require("../../database.js");
const path = require("path");

async function getUserName(uid, api, Users) {
  try {
    const name = await Users.getNameUser(uid);
    if (name) return name;
    const info = await api.getUserInfo(uid);
    return info?.[uid]?.name || `FB-User(${uid})`;
  } catch {
    return `FB-User(${uid})`;
  }
}

module.exports.config = {
  name: "inviteEvent",
  eventType: ["log:subscribe"],
  version: "1.4.0",
  credits: "ChatGPT + NN",
};

module.exports.run = async function({ api, event, Users }) {
  try {
    const { threadID, logMessageData } = event;
    const addedParticipants = logMessageData.addedParticipants;
    if (!addedParticipants || addedParticipants.length === 0) return;

    // Fallback inviter detection
    for (let newP of addedParticipants) {
      const newUserID = newP.userFbId;
      if (newUserID === api.getCurrentUserID()) continue; // skip bot

      const inviterID = newP.inviterID || logMessageData.inviterID;
      if (!inviterID || inviterID === newUserID) continue;

      // load or initialize GC invite data
      const dbPath = `invite/${threadID}`;
      let gcData = (await getData(dbPath)) || {};
      if (!gcData[inviterID]) gcData[inviterID] = { count: 0 };

      // increment inviter count
      gcData[inviterID].count += 1;
      await setData(dbPath, gcData);

      // get names
      const inviterName = await getUserName(inviterID, api, Users);
      const newUserName = await getUserName(newUserID, api, Users);

      // build styled UI message
      const msg = `╭━[INVITE NOTIF]━╮
┃ 👤 Inviter: ${inviterName}
┃ ➕ Invited: ${newUserName}
┃
┃ 📊 Total Invites: ${gcData[inviterID].count}
╰━━━━━━━━━━━━━━━━━━━━╯`;

      api.sendMessage(msg, threadID);
    }
  } catch (err) {
    console.error("❌ ERROR in inviteEvent module:", err);
  }
};
