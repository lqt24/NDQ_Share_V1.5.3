import { MessageStyle, MessageType } from "../../api-zalo/index.js";
import { isAdmin } from "../../index.js";
import {
  sendMessageComplete,
  sendMessageFailed,
  sendMessageResultRequest,
} from "../../service-dqt/chat-zalo/chat-style/chat-style.js";
import { getGlobalPrefix } from "../../service-dqt/service.js";
import { removeMention } from "../../utils/format-util.js";
import { readManagerFile, writeManagerFile } from "../../utils/io-json.js";
import schedule from 'node-schedule';

// Khởi tạo managerData từ file
export const managerData = {
  data: readManagerFile(),
  hasChanges: false,
};

export async function notifyResetGroup(api) {
  const groupRequiredReset = managerData.data.groupRequiredReset;
  if (groupRequiredReset !== "-1") {
    let group;
    try {
      group = await api.getGroupInfo(groupRequiredReset);
    } catch (error) {
      group = null;
    }

    await sendMessageResultRequest(api,
      group ? MessageType.GroupMessage : MessageType.DirectMessage,
      groupRequiredReset,
      "Khởi động lại hoàn tất!\nBot đã hoạt động trở lại!", true, 30000);
    managerData.data.groupRequiredReset = "-1";
    managerData.hasChanges = true;
  }
}

export async function exitRestartBot(api, message) {
  try {
    const threadId = message.threadId;
    managerData.data.groupRequiredReset = threadId;
    managerData.hasChanges = true;
    saveManagerData();

    await sendMessageResultRequest(api, MessageType.GroupMessage, threadId, "Tiến hành khởi động lại...", true, 12000);

    await new Promise(resolve => setTimeout(resolve, 1000));

    process.exit(0);
  } catch (error) {
    await sendMessageFailed(api, message, "Không thể tắt bot: " + error.message, false, 15000);
  }
}


const saveManagerData = () => {
  writeManagerFile(managerData.data);
  managerData.hasChanges = false;
}

// Kiểm tra và lưu thay đổi mỗi 5 giây sử dụng node-schedule
schedule.scheduleJob('*/5 * * * * *', () => {
  if (managerData.hasChanges) {
    saveManagerData();
  }
});

export async function handleActiveBotUser(
  api,
  message,
  groupSettings
) {
  const content = removeMention(message);
  const threadId = message.threadId;
  const senderId = message.data.uidFrom;
  const prefix = getGlobalPrefix();
  const botCommand = content.replace(`${prefix}bot`, "").trim();

  if (
    !botCommand || botCommand === "on" || botCommand === "off"
  ) {
    if (groupSettings) {
      let newStatus;
      if (!botCommand) {
        newStatus = !groupSettings[threadId].activeBot;
      } else {
        newStatus = botCommand === "off" ? false : true;
      }

      groupSettings[threadId].activeBot = newStatus;

      const statusMessage = newStatus ? "kích hoạt" : "vô hiệu hóa";
      const caption = `Đã ${statusMessage} tương tác thành viên  với bot trong nhóm này.`;
      if (newStatus) {
        await sendMessageComplete(api, message, caption);
      } else {
        await sendMessageFailed(api, message, caption);
      }
    } else {
      await sendMessageFailed(api, message, "Không thể setup nhóm ở tin nhắn riêng tư!");
    }

    return true;
  }

  if (botCommand.includes("privatebot")) {
    const privateCommand = botCommand.replace("privatebot", "").trim();
    let newStatus;
    if (!privateCommand) {
      newStatus = !managerData.data.onBotPrivate;
    } else {
      newStatus = privateCommand === "on" ? true : false;
    }
    managerData.data.onBotPrivate = newStatus;
    managerData.hasChanges = true;
    const statusMessage = newStatus ? "kích hoạt" : "vô hiệu hóa";
    const caption = `Đã ${statusMessage} tương tác lệnh trong tin nhắn riêng tư với tất cả người dùng.`;
    if (newStatus) {
      await sendMessageComplete(api, message, caption);
    } else {
      await sendMessageFailed(api, message, caption);
    }
  }

  if (botCommand.includes("privategame")) {
    const privateCommand = botCommand.replace("privategame", "").trim();
    let newStatus;
    if (!privateCommand) {
      newStatus = !managerData.data.onGamePrivate;
    } else {
      newStatus = privateCommand === "on" ? true : false;
    }
    managerData.data.onGamePrivate = newStatus;
    managerData.hasChanges = true;
    const statusMessage = newStatus ? "kích hoạt" : "vô hiệu hóa";
    const caption = `Đã ${statusMessage} tương tác game trong tin nhắn riêng tư với tất cả người dùng.`;
    if (newStatus) {
      await sendMessageComplete(api, message, caption);
    } else {
      await sendMessageFailed(api, message, caption);
    }
  }

  if (botCommand.includes("rs")) {
    if (isAdmin(senderId)) {
      await exitRestartBot(api, message);
      return true;
    }
    await sendMessageFailed(api, message, "Bạn không có quyền khởi động lại bot!");
  }

  return false;
}

export async function handleActiveGameUser(
  api,
  message,
  groupSettings
) {
  const content = removeMention(message);
  const threadId = message.threadId;
  const prefix = getGlobalPrefix();
  const gameCommand = `${prefix}gameactive`;

  if (
    content === gameCommand ||
    content === `${gameCommand} on` ||
    content === `${gameCommand} off`
  ) {
    let newStatus;
    if (content === gameCommand) {
      newStatus = !groupSettings[threadId].activeGame;
    } else {
      newStatus = content === `${gameCommand} off` ? false : true;
    }

    groupSettings[threadId].activeGame = newStatus;

    const statusMessage = newStatus ? "kích hoạt" : "vô hiệu hóa";
    const caption = `Đã ${statusMessage} xử lý tương tác trò chơi trong nhóm này.`;
    if (newStatus) {
      await sendMessageComplete(api, message, caption);
    } else {
      await sendMessageFailed(api, message, caption);
    }

    return true;
  }

  return false;
}