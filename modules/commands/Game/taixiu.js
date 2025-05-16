module.exports.config = {
  name: "taixiu",
  version: "1.0.0",
  hasPermssion: 0,
  credits: "Thanh Nguyên",
  description: "Chơi tài xỉu mở rộng nhiều hình thức cược",
  commandCategory: "Game",
  usages: "taixiu [tài/xỉu/b3gn/b2gn/ct/cs] [số tiền] [tổng/số]",
  cooldowns: 10
};

const axios = require("axios");

const SETTINGS = {
  ENABLE_PRIVATE_MSG: true,
  BASE_WIN_RATE: 0.95,
  WIN_B3GN: 10,
  WIN_B2GN: 5,
  DELAY_TIME: 2,
  ONE_MATCH: 0.95,
  TWO_MATCH: 2,
  THREE_MATCH: 3,
};

const getImage = (number) => {
  const links = {
    1: "https://files.catbox.moe/djucsp.jpg",
    2: "https://files.catbox.moe/5mbw55.jpg",
    3: "https://files.catbox.moe/r826sl.jpg",
    4: "https://files.catbox.moe/7w2dc3.jpg",
    5: "https://files.catbox.moe/1n2cup.jpg",
    6: "https://files.catbox.moe/cfozie.jpg"
  };
  return links[number] || null;
};

const formatMoney = (int) => int.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");

const getRateByTotal = (total) => {
  if (total >= 4 && total <= 17) return 25;
  return 0;
};

module.exports.run = async function ({ event, api, Currencies, Users, args }) {
  try {
    const moment = require("moment-timezone");
    const { increaseMoney, decreaseMoney } = Currencies;
    const { threadID, messageID, senderID } = event;
    const { sendMessage } = api;

    const username = await Users.getNameUser(senderID);
    const userData = await Currencies.getData(senderID);
    const userMoney = userData.money;

    const input = args[0];
    const bet = parseInt(args[1] === "all" ? userMoney : args[1]);
    const targetNum = parseInt(args[2]);

    if (!input) return sendMessage("Bạn chưa nhập tài/xỉu/b3gn/b2gn/ct/cs", threadID, messageID);
    if (!bet) return sendMessage("Vui lòng nhập số tiền cược.", threadID, messageID);
    if (bet < 1000) return sendMessage("Cược tối thiểu là 1000 VND.", threadID, messageID);
    if (bet > userMoney) return sendMessage("Bạn không đủ tiền để cược.", threadID, messageID);

    const validTags = {
      "tài": "tài", "-t": "tài", "xỉu": "xỉu", "-x": "xỉu",
      "b3gn": "b3gn", "bbgn": "b3gn", "bộ ba giống nhau": "b3gn",
      "b2gn": "b2gn", "bdgn": "b2gn", "bộ đôi giống nhau": "b2gn",
      "ct": "cuoctong", "cược tổng": "cuoctong",
      "cs": "cuocso", "cược số": "cuocso"
    };

    const choice = validTags[input.toLowerCase()];
    if (!choice) return sendMessage("Sai loại cược!", threadID, messageID);

    if (choice === "cuoctong" && (targetNum < 4 || targetNum > 17))
      return sendMessage("Tổng cược phải từ 4 đến 17.", threadID, messageID);

    if (choice === "cuocso" && (targetNum < 1 || targetNum > 6))
      return sendMessage("Số cược phải từ 1 đến 6.", threadID, messageID);

    const dice = [];
    const images = [];
    for (let i = 0; i < 3; i++) {
      const num = Math.floor(Math.random() * 6) + 1;
      dice.push(num);
      const imgStream = (await axios.get(getImage(num), { responseType: "stream" })).data;
      images.push(imgStream);
    }

    const total = dice.reduce((a, b) => a + b, 0);
    const isTriple = dice.every(val => val === dice[0]);
    let result = "lose";
    let winAmount = 0;
    let resultText = "";

    switch (choice) {
      case "cuocso":
        const count = dice.filter(x => x === targetNum).length;
        if (count === 1) winAmount = bet * SETTINGS.ONE_MATCH;
        else if (count === 2) winAmount = bet * SETTINGS.TWO_MATCH;
        else if (count === 3) winAmount = bet * SETTINGS.THREE_MATCH;
        if (count > 0) result = "win";
        resultText = `${targetNum}`;
        break;

      case "cuoctong":
        if (total === targetNum) {
          result = "win";
          winAmount = bet * getRateByTotal(total);
        }
        resultText = `${total}`;
        break;

      case "b3gn":
        if (isTriple) {
          result = "win";
          winAmount = bet * SETTINGS.WIN_B3GN;
          resultText = "bộ ba đồng nhất";
        } else {
          resultText = total >= 11 ? "tài" : "xỉu";
        }
        break;

      case "b2gn":
        const pair = new Set(dice).size === 2;
        if (pair) {
          result = "win";
          winAmount = bet * SETTINGS.WIN_B2GN;
          resultText = "bộ hai đồng nhất";
        } else {
          resultText = total >= 11 ? "tài" : "xỉu";
        }
        break;

      case "tài":
      case "xỉu":
        if (isTriple) {
          resultText = "bộ ba đồng nhất";
        } else {
          resultText = total >= 11 ? "tài" : "xỉu";
        }

        if (resultText === choice) {
          result = "win";
          winAmount = bet * SETTINGS.BASE_WIN_RATE;
        }
        break;
    }

    // ✅ Xử lý tiền: cập nhật số dư, sau đó lấy lại để hiển thị đúng
    if (result === "win") await increaseMoney(senderID, winAmount);
    else await decreaseMoney(senderID, bet);
    const updatedData = await Currencies.getData(senderID);
    const finalMoney = updatedData.money;

    const msg =
      `[🎲 TÀI XỈU ONLINE 🎲]\n` +
      `👤 Người chơi: ${username}\n` +
      `🎯 Cược: ${choice} | Số tiền: ${formatMoney(bet)} VND\n` +
      `🎲 Kết quả: ${dice.join(", ")} (Tổng: ${total})\n` +
      `📌 Kết luận: ${resultText} - ${result === "win" ? "Thắng" : "Thua"} ${formatMoney(Math.floor(result === "win" ? winAmount : bet))} VND\n` +
      `💰 Số dư hiện tại: ${formatMoney(finalMoney)} VND`;

    await sendMessage({ body: msg, attachment: images }, threadID, messageID);

    if (SETTINGS.ENABLE_PRIVATE_MSG) {
      const report = `[MiraiPay] Ngày ${moment().format("DD-MM-YYYY")}\n` +
        `Bạn đã ${result === "win" ? "nhận" : "bị trừ"} ${formatMoney(Math.floor(result === "win" ? winAmount : bet))} VND\n` +
        `Số dư hiện tại: ${formatMoney(finalMoney)} VND\n` +
        `Cảm ơn bạn đã sử dụng dịch vụ!`;

      await sendMessage({ body: report }, senderID);
    }
  } catch (error) {
    console.log(error);
    api.sendMessage("❌ Có lỗi xảy ra khi xử lý lệnh!", event.threadID);
  }
};
