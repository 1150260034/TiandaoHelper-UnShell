# api2.helper.qq.com 协议参考（已破解，线上验证）

> 2026-08-08 通过 frida 明文/密文配对 + 服务器实测确认。
> Python 实现：auto-sign 仓库 `helper_api.py`（HelperApiClient / login）。

## 加密与帧格式

- **算法**：XXTEA（小端字序），32 轮，密钥 `502ccc35a0e27a28`（16 字节 ASCII，
  硬编码于 libapp.so，App 全局常量，与设备/账号/会话无关）。
- **帧格式**（请求与响应相同）：
  `XXTEA-LE( zero_pad(form, (8-(len+4)%8)%8) + uint32_LE(len(form)) )`
- **表单**：Java URLEncoder 风格（安全字符 `a-zA-Z0-9.-*_`，空格→`+`）的 `k=v&` 串。
- 密钥获取 hook：`com.tencent.gamehelper.netscene.base.d` 的
  `getTeaKey()`（static 版本入参为空字符串）。

## HTTP 层

- 端点布局 `/{模块}/{命令}`，如 `user/login`、`game/sendmessage`。
- 头部（App 实测，addHeader hook 捕获）：
  - `Gh-Header: 2-1-1012-{versionCode}-{userId}`（versionCode 如 2103100011）
  - `Content-Type: application/x-www-form-urlencoded`（当前 Tinker 补丁版本；
    2026-03 的 HAR 里是 application/octet-stream，两者服务端都接受过）
  - `Content-Encrypt:`（空）、`Accept-Encrypt:`（空）
  - `User-Agent: Dalvik/2.1.0 (...)`（内容不敏感）
- 错误形态：登录态/参数类错误常返回**未加密 JSON**（`returnCode` 非 0），
  客户端必须兼容明文响应。

## 公共参数（CommonParams）

`cGzip=1, cDevicePPI=280, cEnableTeenMode=0, cGameId=1012, cDeviceImei=0,
cRfixPatch=3333777, cDeviceScreenHeight=1920, cDeviceCPU=arm64-v8a%24x86_64,
cDeviceSP=, cUin=<QQ号>, cSystemVersionCode=32, cDeviceNet=WIFI,
cClientVersionCode=2103100011, cChannelId=, cDeviceMem=127991,
cDeviceMac=00-00-00-00-00-00, cCurrentGameId=10002, cRand=<毫秒时间戳>,
cDeviceScreenWidth=1080, cDeviceModel=HUAWEI+ALN-AL1, cClientVersionName=3.10.0,
cSystem=android, cDeviceId=<16位hex设备指纹>, cSystemVersionName=12,
cLoginType=qqConnect`，外加 `userId` 和 `token`（会话凭证）。

服务端对设备字段取值不敏感（模拟器与真机混用未见差异）。

## user/login（会话签发）

业务参数：`loginType=qqConnect, autoLogin=0, expiresIn=5184000, appId=1104787345,
nickname=, keyType=0, smallUinLogin=0, openid=<QC>, accessToken=<QC>,
userId=<旧 userId 或 0>, lastGetRemarkTime=0, token=<旧 token 或空>,
lastLoginTime=<秒>, userIcon=, payToken=`

- **只需 QC 凭据（openid + access_token）即可全新签发**（userId=0、token 空也行）。
- 响应 `data`：`{uin, userId, token, new, userSig, needAllUin, time, sex, avatar, userName, ...}`。
  **`userSig` 是 TIM(腾讯云通信 IM) 的登录签名**——IM 逆向的关键输入。
- **服务端单会话**：每次 login 使该账号旧 token 失效。
- **陷阱**：携带已失效的旧 token 调用 login 会被整体拒绝（"登录态失效，请重新登录"）；
  此时用空 token 重试即可正常签发。
- **版本门（灰度）**：部分账号返回"当前版本过低，请升级"。与客户端版本号参数
  无严格对应（同一版本号有的账号放行有的拦截），疑为服务端按账号灰度。

## 端点行为速查

| 端点 | 说明 | 备注 |
|------|------|------|
| user/login | 会话签发 | 见上 |
| user/getuserinfo | 用户信息 | 缺业务参数时 -30098 没有找到对应的用户 |
| user/getauth | 授权信息 | 宽松，常返回 0 |
| user/alluin | 关联账号 | IM 关联态门控（见下） |
| game/sendmessage | 发消息（群） | 业务参数：groupId/isRecruit=0/fromRoleId/links=[]/message |
| game/groupmessage | 群消息相关 | 同样受 -30003 门控 |
| game/getnotifyhistory | 通知历史 | 宽松 |
| game/offlinegroupmessage | 离线群消息 | 缺业务参数 -20011 |
| game/chatroles | 聊天角色 | IM 关联态门控 |
| app/reportstatus | 状态上报 | 启动时调用 |

## -30003「登录态失效」门控（重要现象）

- 影响端点：sendmessage / groupmessage / alluin / chatroles（IM 关联）；
  不影响 getauth / getnotifyhistory / login / h5game / WPE 系列。
- **不是固定账号属性**：同一账号不同时刻表现会翻转（下午全失败的账号晚上全通）。
- 已排除的因素：会话来源（App 内会话/脚本登录）、roleId、群成员资格、
  App 在线状态、请求体逐字节一致性、请求头、IP。
- 疑似与服务端风控/IM 注册状态漂移有关，密集登录测试期间出现率显著升高。
- **发消息任务（全民礼包 356560）的替代通道已验证**：App 内通过 TIM 发的消息
  被 bb 后台认可（同步延迟约 10 分钟），不依赖 api2 sendmessage。
