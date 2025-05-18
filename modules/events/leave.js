module.exports.config = {
    name: "leavenoti",
    eventType: ["log:unsubscribe"],
    version: "1.2.0",
    credits: "Thanh Nguyên",
    description: "Notify when a member leaves the group with an MP4 from API",
    dependencies: {
        "axios": "",
        "moment-timezone": ""
    }
};

module.exports.run = async function ({ api, event, Users, Threads }) {
    let threadID;
    try {
        if (event.logMessageData.leftParticipantFbId === api.getCurrentUserID()) return;

        threadID = event.threadID;
        const { author, logMessageData } = event;
        const moment = require("moment-timezone");
        moment.locale('vi');

        const time = moment.tz("Asia/Ho_Chi_Minh").format("HH:mm:ss - DD/MM/YYYY");

        const uid = logMessageData.leftParticipantFbId;
        const name = global.data.userName.get(uid) || await Users.getNameUser(uid);

        let memberCount = 0;
        try {
            const threadData = await Threads.getData(threadID);
            memberCount = threadData?.threadInfo?.participantIDs?.length || 0;
        } catch (err) {
            console.warn("Failed to get thread info:", err);
        }

        const leaveType = (author === uid) ? "Thành viên đã rời nhóm" : "Thành viên đã bị kick";

        const message = [
            `➾ Bây Giờ Là: ${time}`,
            `➾ ${leaveType}`,
            `▭▭▭▭ [ INFO ] ▭▭▭▭`,
            `⋄ Name: ${name}`,
            `⋄ Là Thành Viên Số ${memberCount} Của Nhóm Trước Khi Rời!`,
            `⋄ Chúc ${name} May Mắn Những Điều Tốt Đẹp 🍀`,
            `▭▭▭▭▭▭▭▭▭▭▭▭`
        ].join('\n');

        await api.sendMessage(message, threadID);

        const axios = require("axios");
        // 🔁 Thay đổi API sang trả về video mp4
        const videoResponse = await axios.get("https://apidocs-ten.vercel.app/api/vdanime?apikey=tnguyen001", {
            responseType: "json"
        });

        const videoUrl = videoResponse.data?.url;
        if (!videoUrl || !videoUrl.endsWith(".mp4")) {
            await api.sendMessage("⚠️ Không thể lấy URL MP4 từ API.", threadID);
            return;
        }

        const videoStream = (await axios.get(videoUrl, { responseType: "stream" })).data;
        await api.sendMessage({ attachment: videoStream }, threadID);

    } catch (error) {
        console.error("Error in leavenoti:", error);
        if (threadID) {
            await api.sendMessage("⚠️ Đã xảy ra lỗi khi xử lý sự kiện rời nhóm.", threadID);
        }
    }
};
