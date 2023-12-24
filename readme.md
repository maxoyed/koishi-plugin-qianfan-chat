# koishi-plugin-qianfan-chat

[![npm](https://img.shields.io/npm/v/koishi-plugin-qianfan-chat?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-qianfan-chat)

基于百度智能云千帆大模型平台的 AI 对话&绘画插件。此插件可同时启用多份，通过 `COMMAND` 配置项指定不同的指令，通过 `system` 指定 AI 人设，可快速添加多个不同的角色卡。

## 配置项

- `COMMAND`: 聊天指令名称，默认 chat
- `CHAT_MODEL`: 使用的模型，支持 ERNIE-Bot-4、ERNIE-Bot、ERNIE-Bot-turbo
- `ENDPOINT`: 申请发布时填写的 API 地址，优先级高于 `CHAT_MODEL`
- `GENERATE_IMAGE`: 是否根据内容生成图片
- `GENERATE_IMAGE_STYLE`: 生成图片的风格
- `OPEN_IMAGINE_CMD`: 是否开启绘画指令
- `system`: AI 系统人设，不超过 1024 个字，常用于设定角色卡
- `temperature`: 较高的数值会使输出更加随机，而较低的数值会使其更加集中和确定；默认 0.95，建议该参数和 `top_p` 只改动 1 个
- `top_p`: 影响输出文本的多样性，取值越大，生成文本的多样性越强；默认 0.8，建议该参数和 `temperature` 只改动 1 个
- `penalty_score`: 取值范围 [1.0, 2.0]；通过对已生成的 token 增加惩罚，减少重复生成的现象，值越大表示惩罚越大
- `OPEN_HISTORY`: 是否开启多轮对话
- `MAX_ROUND`: 多轮对话的最大轮数
- `ROUND_DURATION`: 多轮对话自动结束的时间间隔，单位：秒

## 指令说明

### chat [prompt:rawtext]

聊天

- `prompt`: 提示词；若开启多轮对话，不传 promp 表示开始新一轮对话；若关闭多轮对话，则必须传入 prompt

### imagine [prompt:rawtext]

绘画

- `prompt`: 千帆大模型平台文生图使用 Stable Diffusion，提示词按照 SD 的格式传即可

## 服务依赖

[koishi-plugin-qianfan-service](https://github.com/maxoyed/koishi-plugin-qianfan-service)
