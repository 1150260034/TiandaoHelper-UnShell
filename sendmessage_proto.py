#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SendMessage Protobuf Implementation

Analyzes and implements the sendmessage protobuf structure for 天刀助手 API.
API Endpoint: POST https://api2.helper.qq.com/game/sendmessage

Based on reverse engineering analysis from libapp_so_逆向分析报告.md and
captured binary data (sendmessage_req.bin).

The protobuf structure follows the lib_base_proto/comment/comment.app.api.pb.dart pattern.
"""

import struct
import urllib.parse
import requests
import json
from typing import Optional, Dict, Any


class SendMessageProto:
    """SendMessage Protobuf 构造器"""

    # API endpoint
    API_URL = "https://api2.helper.qq.com/game/sendmessage"

    # Gh-Header format: version-sequence-gameid-buildver-userid
    # Example: 2-1-1012-2103100011-220359271
    DEFAULT_GH_HEADER = "2-1-1012-2103100011-220359271"

    def __init__(self, gh_header: str = None):
        """
        初始化 SendMessageProto

        Args:
            gh_header: Gh-Header值，格式: version-sequence-gameid-buildver-userid
        """
        self.gh_header = gh_header or self.DEFAULT_GH_HEADER
        self.session = requests.Session()
        self._setup_session()

    def _setup_session(self):
        """设置会话请求头"""
        self.session.headers.update({
            'Gh-Header': self.gh_header,
            'Content-Type': 'application/octet-stream',
            'Accept': '*/*',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 16; 23116PN5BC Build/BP2A.250605.031.A3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/137.0.7151.115 Mobile Safari/537.36 GH_QQConnect GameHelper_1012/2103100009',
        })

    @staticmethod
    def encode_varint(value: int) -> bytes:
        """
        编码 varint (protobuf variable-length integer)

        Args:
            value: 要编码的整数

        Returns:
            编码后的字节串
        """
        if value < 0:
            # 处理负数 (int64)
            value = value & 0xFFFFFFFFFFFFFFFF
            result = []
            while value >= 0x80:
                result.append((value & 0x7F) | 0x80)
                value >>= 7
            result.append(value & 0x7F)
            return bytes(result)

        result = []
        while value >= 0x80:
            result.append((value & 0x7F) | 0x80)
            value >>= 7
        result.append(value & 0x7F)
        return bytes(result)

    @staticmethod
    def encode_tag(field_number: int, wire_type: int) -> bytes:
        """
        编码 protobuf tag

        Args:
            field_number: 字段编号
            wire_type: 线类型 (0=varint, 1=64-bit, 2=length-delimited, 5=32-bit)

        Returns:
            编码后的 tag 字节
        """
        tag = (field_number << 3) | wire_type
        return SendMessageProto.encode_varint(tag)

    @staticmethod
    def encode_string(field_number: int, value: str) -> bytes:
        """
        编码字符串字段 (wire_type=2, length-delimited)

        Args:
            field_number: 字段编号
            value: 字符串值

        Returns:
            编码后的字节串
        """
        data = value.encode('utf-8')
        return SendMessageProto.encode_tag(field_number, 2) + \
               SendMessageProto.encode_varint(len(data)) + \
               data

    @staticmethod
    def encode_int64(field_number: int, value: int) -> bytes:
        """
        编码 int64 字段 (wire_type=0, varint)

        Args:
            field_number: 字段编号
            value: 整数值

        Returns:
            编码后的字节串
        """
        return SendMessageProto.encode_tag(field_number, 0) + \
               SendMessageProto.encode_varint(value)

    @staticmethod
    def encode_int32(field_number: int, value: int) -> bytes:
        """
        编码 int32 字段 (wire_type=0, varint)

        Args:
            field_number: 字段编号
            value: 整数值

        Returns:
            编码后的字节串
        """
        return SendMessageProto.encode_tag(field_number, 0) + \
               SendMessageProto.encode_varint(value & 0xFFFFFFFF)

    @staticmethod
    def xor_encode(data: bytes, key: int = 0x3F) -> bytes:
        """
        XOR 编码数据 (用于发送前加密)

        根据抓包数据分析，发送的数据经过 XOR 编码。
        0x3F 是常见的 XOR 密钥。

        Args:
            data: 原始数据
            key: XOR 密钥 (默认 0x3F)

        Returns:
            XOR 编码后的数据
        """
        return bytes(b ^ key for b in data)


class AddCommentRequest:
    """
    AddComment 请求消息结构

    基于 libapp_so 逆向分析得到的 ProtoBuf 结构：
    - content: 消息内容 (string)
    - targetId: 目标 ID (string/int)
    - targetType: 目标类型 (int)
    - atUsers: @用户列表 (repeated string)

    对应字段编号 (根据 ProtoBuf 命名规则常见编号):
    - content = 1
    - targetId = 2
    - targetType = 3
    - atUsers = 4
    """

    FIELD_CONTENT = 1
    FIELD_TARGET_ID = 2
    FIELD_TARGET_TYPE = 3
    FIELD_AT_USERS = 4

    def __init__(self):
        self.content: str = ""
        self.target_id: str = ""
        self.target_type: int = 0
        self.at_users: list = []

    def build(self) -> bytes:
        """
        构 sendmessage_req.bin 的二进制数据 (XOR 编码前)

        根据抓包数据分析，sendmessage_req.bin 包含以下结构：
        - 消息内容 (content)
        - 目标ID (targetId)
        - 目标类型 (targetType)
        - @用户列表 (atUsers)

        Returns:
            Protobuf 二进制数据 (编码前)
        """
        result = b""

        # Field 1: content (string, wire_type=2)
        if self.content:
            content_bytes = self.content.encode('utf-8')
            result += SendMessageProto.encode_tag(self.FIELD_CONTENT, 2)  # tag
            result += SendMessageProto.encode_varint(len(content_bytes))   # length
            result += content_bytes                                      # data

        # Field 2: targetId (string, wire_type=2)
        if self.target_id:
            target_id_bytes = self.target_id.encode('utf-8')
            result += SendMessageProto.encode_tag(self.FIELD_TARGET_ID, 2)
            result += SendMessageProto.encode_varint(len(target_id_bytes))
            result += target_id_bytes

        # Field 3: targetType (varint, wire_type=0)
        result += SendMessageProto.encode_tag(self.FIELD_TARGET_TYPE, 0)
        result += SendMessageProto.encode_varint(self.target_type)

        # Field 4: atUsers (repeated string, wire_type=2)
        for user in self.at_users:
            user_bytes = user.encode('utf-8')
            result += SendMessageProto.encode_tag(self.FIELD_AT_USERS, 2)
            result += SendMessageProto.encode_varint(len(user_bytes))
            result += user_bytes

        return result

    def to_xor_bytes(self) -> bytes:
        """
        获取 XOR 编码后的发送数据

        Returns:
            XOR 编码后的二进制数据
        """
        raw_bytes = self.build()
        return SendMessageProto.xor_encode(raw_bytes)


def send_message(
    content: str,
    target_id: str = "",
    target_type: int = 1,
    at_users: list = None,
    gh_header: str = None,
    cookies: Dict[str, str] = None
) -> tuple:
    """
    发送游戏消息

    Args:
        content: 消息内容
        target_id: 目标 ID (可选)
        target_type: 目标类型 (默认 1)
        at_users: @用户列表 (可选)
        gh_header: Gh-Header 值
        cookies: Cookie 字典 (可选)

    Returns:
        (是否成功, 响应数据)
    """
    if at_users is None:
        at_users = []

    # 构建请求
    proto = SendMessageProto(gh_header)
    request = AddCommentRequest()
    request.content = content
    request.target_id = target_id
    request.target_type = target_type
    request.at_users = at_users

    # 获取发送数据 (XOR 编码)
    send_data = request.to_xor_bytes()

    try:
        # 设置 Cookie
        if cookies:
            proto.session.cookies.update(cookies)

        # 发送请求
        response = proto.session.post(
            SendMessageProto.API_URL,
            data=send_data,
            timeout=10
        )
        response.raise_for_status()

        return True, response.content

    except requests.RequestException as e:
        return False, str(e)


def parse_sendmessage_response(resp_data: bytes) -> Dict[str, Any]:
    """
    解析发送消息响应

    注意：响应数据可能是 XOR 编码的

    Args:
        resp_data: 响应原始数据

    Returns:
        解析后的响应字典
    """
    # 尝试 XOR 解码
    try:
        decoded = SendMessageProto.xor_encode(resp_data)
        # 尝试解析为 JSON
        return {"raw": decoded.hex(), "decoded": decoded}
    except:
        return {"raw": resp_data.hex()}


if __name__ == '__main__':
    # 测试代码
    print("SendMessage Protobuf Implementation")
    print("=" * 50)

    # 示例：构造 AddComment 请求
    request = AddCommentRequest()
    request.content = "test message"
    request.target_id = "12345"
    request.target_type = 1
    request.at_users = []

    raw_data = request.build()
    xor_data = request.to_xor_bytes()

    print(f"Raw protobuf length: {len(raw_data)}")
    print(f"XOR encoded length: {len(xor_data)}")
    print(f"Raw protobuf (hex): {raw_data.hex()}")
    print(f"XOR encoded (hex): {xor_data.hex()}")

    # 对比 sendmessage_req.bin
    import os
    req_bin_path = os.path.join(os.path.dirname(__file__), "sendmessage_req.bin")
    if os.path.exists(req_bin_path):
        with open(req_bin_path, 'rb') as f:
            actual_data = f.read()
        print(f"\nActual sendmessage_req.bin length: {len(actual_data)}")
        print(f"Actual sendmessage_req.bin (hex): {actual_data.hex()}")