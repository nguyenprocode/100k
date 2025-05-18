const axios = require("axios");
const moment = require("moment-timezone");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "join",
  eventType: ["log:subscribe"],
  version: "1.2.0",
  credits: "Thanh Nguyên (fix by ChatGPT)",
  description: "Gửi thông báo và video khi bot hoặc thành viên được thêm vào nhóm",
};

module.exports.run = async function ({ api, event }) {
  const { threadID, logMessageData } = event;
  if (!threadID || !logMessageData?.addedParticipants) return;

  const botID = api.getCurrentUserID();
  const isBotAdded = logMessageData.addedParticipants.some(i => i.userFbId === botID);
  const time = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss - DD/MM/YYYY");

  const getMP4Stream = async () => {
    try {
      const res = await axios.get("https://apidocs-ten.vercel.app/api/vdanime?apikey=tnguyen001"); // hoặc API mp4 khác
      if (!res.data?.url || !res.data.url.endsWith(".mp4")) throw new Error("Không lấy được URL video");

      const videoUrl = res.data.url;
      const filePath = path.join(__dirname, "join_video.mp4");

      const response = await axios({
        url: videoUrl,
        method: "GET",
        responseType: "stream"
      });

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", () => resolve(fs.createReadStream(filePath)));
        writer.on("error", reject);
      });
    } catch (err) {
      console.error("❌ Lỗi tải video:", err);
      return null;
    }
  };

  // Khi bot được thêm vào nhóm
  if (isBotAdded) {
    try {
      await api.changeNickname(
        `『 ${global.config.PREFIX} 』 • ${global.config.BOTNAME || "Bot"}`,
        threadID,
        botID
      );

      const threadInfo = await api.getThreadInfo(threadID);
      const memberCount = threadInfo.participantIDs.length;

      const message = [
        `➾ Bây Giờ Là: ${time}`,
        `➾ Bot Đã Được Thêm Vào Nhóm Này!`,
        `▭▭▭▭ [ BOT INFO ] ▭▭▭▭`,
        `⋄ Tên Bot: ${global.config.BOTNAME || "Bot"}`,
        `⋄ Là Thành Viên Số ${memberCount} Của Nhóm!`,
        `⋄ Mình Rất Hân Hạnh Được Phục Vụ Mọi Người! 🤖`,
        `▭▭▭▭▭▭▭▭▭▭▭▭`
      ].join("\n");

      await api.sendMessage(message, threadID);

      const videoStream = await getMP4Stream();
      if (videoStream) {
        api.sendMessage({ attachment: videoStream }, threadID, () => {
          fs.unlinkSync(path.join(__dirname, "join_video.mp4"));
        });
      }
    } catch (e) {
      console.error("❌ Bot Join Error:", e);
      return api.sendMessage("❌ Lỗi khi xử lý bot vào nhóm!", threadID);
    }
    return;
  }

  // Khi thành viên thường được thêm vào nhóm
  try {
    const added = logMessageData.addedParticipants;
    const threadInfo = await api.getThreadInfo(threadID);
    const memberCount = threadInfo.participantIDs.length;

    const nameArray = added.map(user => user.fullName || "Không Rõ");
    const mentions = added.map(user => ({
      tag: user.fullName || "Không Rõ",
      id: user.userFbId
    }));

    const message = [
      `➾ Bây Giờ Là: ${time}`,
      `➾ Xin Chào Mừng Thành Viên Mới Của Chúng Ta !!!`,
      `▭▭▭▭ [ INFO ] ▭▭▭▭`,
      `⋄ Name: ${nameArray.join(", ")}`,
      `⋄ Là Thành Viên Số ${memberCount} Của Nhóm!`,
      `⋄ Chúc ${nameArray.join(", ")} Một Ngày Vui Vẻ 🍒`,
      `▭▭▭▭▭▭▭▭▭▭▭▭`
    ].join("\n");

    await api.sendMessage({ body: message, mentions }, threadID);

    const videoStream = await getMP4Stream();
    if (videoStream) {
      api.sendMessage({ attachment: videoStream }, threadID, () => {
        fs.unlinkSync(path.join(__dirname, "join_video.mp4"));
      });
    }
  } catch (err) {
    console.error("❌ Member Join Error:", err);
    return api.sendMessage("❌ Gặp lỗi khi gửi chào mừng!", threadID);
  }
};
