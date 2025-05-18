const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports.config = {
  name: "zingmp3",
  version: "1.0.4",
  hasPermssion: 0,
  credits: "KyPhan",
  description: "Tìm kiếm và tải nhạc từ ZingMP3",
  commandCategory: "Giải Trí",
  usages: "[tên bài hát]",
  cooldowns: 5
};

module.exports.run = async function ({ api, event, args }) {
  try {
    const search = args.join(" ");
    if (!search) return api.sendMessage("⚠️ Vui lòng nhập từ khóa tìm kiếm", event.threadID, event.messageID);

    const res = await axios.get(`https://kyphandev.site/search/zingmp3?q=${encodeURIComponent(search)}`);
    const result = res.data;

    if (!result?.data?.items || result.data.items.length === 0)
      return api.sendMessage("❗Không tìm thấy kết quả phù hợp.", event.threadID, event.messageID);

    const items = result.data.items.slice(0, 5);

    let message = "•- [ Kết quả tìm kiếm ZingMP3 ] -•\n\n";
    const attachments = [];

    for (let i = 0; i < items.length; i++) {
      const { thumbnail, title, duration, link, artistsNames } = items[i];
      message += `${i + 1}. 🎵 Tiêu đề: ${title}\n👤 Ca sĩ: ${artistsNames}\n⏳ Thời lượng: ${duration}\n\n`;

      const imgRes = await axios.get(thumbnail, { responseType: 'arraybuffer' });
      const imgPath = path.resolve(__dirname, `cache/${event.threadID}_${i}.jpg`);
      fs.writeFileSync(imgPath, imgRes.data);
      attachments.push(fs.createReadStream(imgPath));
    }

    api.sendMessage({
      body: message,
      attachment: attachments
    }, event.threadID, (err, info) => {
      if (err) return api.sendMessage(`Lỗi gửi tin nhắn: ${err.message}`, event.threadID, event.messageID);

      global.client.handleReply.push({
        type: "chooseSong",
        name: this.config.name,
        messageID: info.messageID,
        author: event.senderID,
        results: items
      });

      attachments.forEach(file => fs.unlinkSync(file.path));
    });

  } catch (error) {
    return api.sendMessage(`❌ Lỗi: ${error.message}`, event.threadID, event.messageID);
  }
};

module.exports.handleReply = async function ({ api, event, handleReply }) {
  try {
    const index = parseInt(event.body);
    if (isNaN(index) || index < 1 || index > handleReply.results.length)
      return api.sendMessage("❗ Số thứ tự không hợp lệ.", event.threadID, event.messageID);

    api.unsendMessage(handleReply.messageID);

    const selected = handleReply.results[index - 1];
    const { link, artistsNames } = selected;

    const res = await axios.get(`https://kyphandev.site/down/zingmp3?link=${encodeURIComponent(link)}`);
    const { title, download_url } = res.data;

    if (!download_url)
      return api.sendMessage("❌ Không thể tải bài hát này.", event.threadID, event.messageID);

    const fileName = `${title}.mp3`;
    const filePath = path.resolve(__dirname, `cache/${fileName}`);
    const music = await axios.get(download_url, { responseType: 'arraybuffer' });

    fs.writeFileSync(filePath, music.data);

    api.sendMessage({
      body: `🎵 ${title}`,
      attachment: fs.createReadStream(filePath)
    }, event.threadID, () => fs.unlinkSync(filePath), event.messageID);

  } catch (error) {
    return api.sendMessage(`❌ Lỗi khi tải nhạc: ${error.message}`, event.threadID, event.messageID);
  }
};
