# IM（TIM）通道逆向交接文档

> 目标：脚本化发送群聊消息，使全民礼包"发消息"任务（WPE 356560）
> 对全部账号可脚本完成。前置结论见 `docs/api2_helper_protocol.md`。

## 为什么需要它

- api2 `game/sendmessage` 对部分账号/时段返回 -30003（见协议文档），不可靠。
- 已实测：**TIM 通道发出的消息被任务后台认可**（约 10 分钟同步延迟），
  与 api2 发送等效。
- 模拟器只作分析环境，最终形态必须是纯脚本（FC 运行）。

## 已掌握的资产

1. **userSig 免费拿**：api2 `/user/login` 响应 `data.userSig` 就是 TIM 登录签名。
   登录响应还含 userId（TIM identifier 可能与它或 uin 相关，需验证）。
2. **SDK**：`lib/arm64-v8a/libImSDK.so`（3.4MB，腾讯云通信 TIM 客户端 SDK）。
   Java 层封装在脱壳后的 dex 里（`com.tencent.imsdk.*` 类，见 decompiled_all）。
3. **运行时环境**：MuMu（Android 12, x86_64+ARM 翻译, root），
   frida-server 17.8.3 在 /data/local/tmp/，App 包名 com.tencent.gamehelper.wuxia。
   frida 脚本在 `frida_scripts/`（v5 加密层 hook 可直接复用；
   AccountManager.j() 可读当前会话 userId/token）。
4. **设备上现成数据**：每个登录过的账号有独立数据库
   `databases/{userId}.db`（Session/Role 表可读群 ID、角色 ID）。

## 推荐路线（按性价比排序）

### 路线 A：frida RPC 驱动 App 自带 IM SDK（强烈建议先试）

不重实现协议，直接调 App 进程里的现成方法：
1. 在 decompiled 源码里找 TIM 调用的 Java 入口（搜 `V2TIMManager`、`sendMessage`、
   `login(` 相关类）。
2. frida 附着 App → Java.use 拿到管理类 → 依次调用
   initSDK → login(userId/identifier, userSig) → sendMessage(群会话, 文本)。
3. 跑通后评估脱离模拟器的可行性：此路线本身仍需要 App 进程，
   它的真正价值是**验证 TIM 登录/发送的参数与行为**，为路线 B 提供参照。

### 路线 B：纯协议重实现（最终目标）

TIM 客户端协议是私有 SSO 协议（msf 衍生，Protobuf/Jce，wss 长连接）：
1. 用 frida hook Java 层 IMSDK 调用拿到登录/发信的完整输入参数。
2. 需要更深时用 frida-tracer/抓 wss 帧分析包结构。
3. 注意工作量评估：无公开文档，做好数天~数周的心理准备；
   若能找到 TIM 开源社区资料（搜 "TIM SDK 协议 逆向"、"imsdk wss"）可大幅缩短。

### 路线 C（保底，不算纯脚本但零风险）

模拟器常驻 + adb UI 自动化定时发消息（本仓库已验证可行的点击/输入流程：
聊天 tab → 消息 → 群 → 输入 → 发送）。缺点：多账号需要 App 内切号。

## 已排除/已确认的事实（别重复验证）

- api2 sendmessage 的 -30003 与会话来源、roleId、群成员、App 在线、
  请求体/头、IP 均无关；且会随时间漂移。
- `game/groupmessage` 同样被门控。
- WPE 356560 领取只看 bb 后台的聊天消息记录（任意通道），
  任务记录可跨小时甚至跨零点保留。
- /user/login 单会话制；带失效旧 token 登录会被整体拒绝（空 token 重试即可）。
