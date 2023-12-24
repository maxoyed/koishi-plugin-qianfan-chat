import { Context, Schema, Logger } from 'koishi'
import { ChatBody, ChatModel } from 'qianfan/dist/interface'
import {} from 'koishi-plugin-qianfan-service'

export const name = 'qianfan-chat'
export const reusable = true
export const inject = ['qianfan', 'database']

const logger = new Logger(name)

export interface Config {
  COMMAND: string
  CHAT_MODEL: ChatModel
  ENDPOINT: string
  GENERATE_IMAGE: boolean
  GENERATE_IMAGE_STYLE:
    | 'Base'
    | '3D Model'
    | 'Analog Film'
    | 'Anime'
    | 'Cinematic'
    | 'Comic Book'
    | 'Craft Clay'
    | 'Digital Art'
    | 'Enhance'
    | 'Fantasy Art'
    | 'lsometric'
    | 'Line Art'
    | 'Lowpoly'
    | 'Neonpunk'
    | 'Origami'
    | 'Photographic'
    | 'Pixel Art'
    | 'Texture'
  OPEN_IMAGINE_CMD: boolean
  system: string
  temperature: number
  top_p: number
  penalty_score: number
  OPEN_HISTORY: boolean
  MAX_ROUND: number
  ROUND_DURATION: number
}

export interface QianfanChat {
  id: number
  uid: number
  cmd: string
  is_start: boolean
  role: 'user' | 'assistant'
  content: string
  tokens: number
  create_at: Date
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    COMMAND: Schema.string().default('chat').description('指令名称，不可重复'),
    CHAT_MODEL: Schema.union([
      'ERNIE-Bot-4',
      'ERNIE-Bot-8K',
      'ERNIE-Bot',
      'ERNIE-Bot-turbo',
      'EB-turbo-AppBuilder',
      'Yi-34B-Chat',
      'BLOOMZ-7B',
      'Qianfan-BLOOMZ-7B-compressed',
      'Llama-2-7b-chat',
      'Llama-2-13b-chat',
      'Llama-2-70b-chat',
      'Qianfan-Chinese-Llama-2-7B',
      'Qianfan-Chinese-Llama-2-13B',
      'ChatGLM2-6B-32K',
      'XuanYuan-70B-Chat-4bit',
      'ChatLaw',
      'AquilaChat-7B',
    ] as ChatModel[])
      .default('ERNIE-Bot' as ChatModel)
      .description('对话模型'),
    ENDPOINT: Schema.string().default('').description('申请发布时填写的API地址，优先级高于 `CHAT_MODEL`'),
    GENERATE_IMAGE: Schema.boolean().default(false).description('是否根据内容生成图片'),
    GENERATE_IMAGE_STYLE: Schema.union([
      'Base',
      '3D Model',
      'Analog Film',
      'Anime',
      'Cinematic',
      'Comic Book',
      'Craft Clay',
      'Digital Art',
      'Enhance',
      'Fantasy Art',
      'lsometric',
      'Line Art',
      'Lowpoly',
      'Neonpunk',
      'Origami',
      'Photographic',
      'Pixel Art',
      'Texture',
    ])
      .default('Base')
      .description('生成图片的风格'),
    OPEN_IMAGINE_CMD: Schema.boolean().default(false).description('是否开启文生图指令'),
    system: Schema.string()
      .role('textarea', { rows: [2, 6] })
      .max(1024)
      .description('AI人设'),
    temperature: Schema.number()
      .role('slider')
      .step(0.01)
      .default(0.95)
      .min(0.01)
      .max(1)
      .description('较高的数值会使输出更加随机，而较低的数值会使其更加集中和确定\n\n建议该参数和 `top_p` 只设置1个'),
    top_p: Schema.number()
      .role('slider')
      .step(0.01)
      .default(0.8)
      .min(0)
      .max(1)
      .description('影响输出文本的多样性，取值越大，生成文本的多样性越强\n\n建议该参数和 `temperature` 只设置 1 个'),
    penalty_score: Schema.number()
      .role('slider')
      .step(0.01)
      .default(1.0)
      .min(1)
      .max(2)
      .description('通过对已生成的token增加惩罚，减少重复生成的现象，值越大表示惩罚越大'),
    OPEN_HISTORY: Schema.boolean().default(false).description('是否开启多轮对话'),
  }).description('基础配置'),
  Schema.union([
    Schema.object({
      OPEN_HISTORY: Schema.const(true).required().description('是否开启多轮对话'),
      HISTORY_ROUND: Schema.number().default(10).description('多轮对话最大轮数'),
      ROUND_DURATION: Schema.number().default(60).description('自动结束会话间隔/秒'),
    }).description('多轮对话配置'),
    Schema.object({}),
  ]),
]) as any

declare module 'koishi' {
  interface Tables {
    qianfan_chat: QianfanChat
  }
}

export function apply(ctx: Context, config: Config) {
  // 扩展数据库
  if (config.OPEN_HISTORY) {
    ctx.model.extend(
      'qianfan_chat',
      {
        id: 'unsigned',
        uid: 'unsigned',
        cmd: 'string',
        is_start: 'boolean',
        role: 'string',
        content: 'text',
        tokens: 'unsigned',
        create_at: 'timestamp',
      },
      {
        autoInc: true,
        foreign: {
          uid: ['user', 'id'],
        },
      }
    )
  }
  // 对话指令
  ctx
    .command(`${config.COMMAND} [prompt:rawtext]`, `对话`)
    .userFields(['id'])
    .action(async ({ session }, prompt: string) => {
      logger.debug({ prompt })
      let chat_body = {
        messages: [
          {
            role: 'user',
            content: '开始',
          },
        ],
        temperature: config.temperature,
        top_p: config.top_p,
        penalty_score: config.penalty_score,
        user_id: session.userId,
      } as any
      // 处理 system
      if (config.CHAT_MODEL.startsWith('ERNIE-Bot') && config.ENDPOINT.length === 0) {
        chat_body.system = config.system
      }
      // 处理temperature和top_p
      if (config.temperature != 0.95) {
        chat_body.temperature = config.temperature
        delete chat_body.top_p
      }
      if (config.temperature == 0.95 && config.top_p != 0.8) {
        chat_body.top_p = config.top_p
        delete chat_body.temperature
      }
      if (prompt) {
        chat_body.messages[0].content = prompt
      }
      // 多轮对话处理
      if (prompt && config.OPEN_HISTORY) {
        const minCreateTime = new Date(new Date().getTime() - config.ROUND_DURATION * 1000)
        // 查询上一次对话
        const latestRecord = await ctx.database
          .select('qianfan_chat')
          .where({
            uid: session.user.id,
            cmd: config.COMMAND,
            create_at: {
              $gte: minCreateTime,
            },
          })
          .orderBy('id', 'desc')
          .limit(1)
          .execute()
        if (latestRecord.length === 0) {
          // 如果没有上一次对话，则直接返回
          return (
            <>
              <quote id={session.messageId} />
              请先使用`{config.COMMAND}`指令开始对话
            </>
          )
        }
        const latestStart = await ctx.database
          .select('qianfan_chat')
          .where({
            uid: session.user.id,
            cmd: config.COMMAND,
            is_start: true,
          })
          .orderBy('id', 'desc')
          .limit(1)
          .execute()
        if (latestStart.length === 1) {
          let historyAfterStart = await ctx.database
            .select('qianfan_chat')
            .where({
              id: {
                $gte: latestStart[0].id,
              },
              uid: session.user.id,
              cmd: config.COMMAND,
            })
            .orderBy('id', 'desc')
            .limit(config.MAX_ROUND - 1)
            .execute()
          // reverse history
          historyAfterStart.reverse()
          logger.debug({ historyAfterStart })
          const historyMessages = historyAfterStart.map((item) => {
            return {
              role: item.role,
              content: item.content,
            }
          })
          historyMessages.push({
            role: 'user',
            content: prompt,
          })
          // 如果historyMessages的第一个元素的role不为user，则删除第一个元素
          if (historyMessages[0].role !== 'user') {
            historyMessages.shift()
          }
          if (!config.CHAT_MODEL.startsWith('ERNIE-Bot') || config.ENDPOINT.length > 0) {
            historyMessages[0].content = config.system + '\n\n' + historyMessages[0].content
          }
          // 将historyMessages添加到chat_body中
          chat_body.messages = historyMessages
        }
      }
      if (!prompt && !config.OPEN_HISTORY) {
        return (
          <>
            <quote id={session.messageId} />
            你想聊什么呢？
          </>
        )
      }
      // 处理 system
      if ((!config.CHAT_MODEL.startsWith('ERNIE-Bot') || config.ENDPOINT.length > 0) && chat_body.messages.length === 1) {
        chat_body.messages[0].content = config.system + '\n\n' + chat_body.messages[0].content
      }
      logger.debug({ chat_body })
      // 发起请求
      const resp = await ctx.qianfan.chat(chat_body, config.CHAT_MODEL, config.ENDPOINT)
      if (!resp.need_clear_history) {
        // 如果开启多轮对话，则将对话记录存入数据库
        if (config.OPEN_HISTORY) {
          // 用户消息
          await ctx.database.create('qianfan_chat', {
            uid: session.user.id,
            cmd: config.COMMAND,
            is_start: prompt ? false : true,
            role: 'user',
            content: prompt ? prompt : '开始',
            tokens: resp.usage.prompt_tokens,
            create_at: new Date(),
          })
          // AI消息
          await ctx.database.create('qianfan_chat', {
            uid: session.user.id,
            cmd: config.COMMAND,
            is_start: false,
            role: 'assistant',
            content: resp.result,
            tokens: resp.usage.completion_tokens,
            create_at: new Date(),
          })
        }
        // 处理文案图片生成
        if (config.GENERATE_IMAGE) {
          const imagePromptChinese = await ctx.qianfan.chat(
            {
              messages: [
                {
                  role: 'user',
                  content: `你是一个AI绘画助手。\n\n${resp.result}\n\n使用一句话回答，以上内容的绘画关键词是：`,
                },
              ],
            },
            config.CHAT_MODEL,
            config.ENDPOINT
          )
          logger.debug({ imagePromptChinese: imagePromptChinese.result })
          const imagePromptEnglish = await ctx.qianfan.chat(
            {
              messages: [
                {
                  role: 'user',
                  content: `你是一个中英翻译助手。\n\n${imagePromptChinese.result}\n\n使用一句话回答，不需要简化，以上内容翻译为英文是：`,
                },
              ],
            },
            config.CHAT_MODEL,
            config.ENDPOINT
          )
          logger.debug({ imagePromptEnglish: imagePromptEnglish.result })
          const imageRes = await ctx.qianfan.imagine({
            prompt: imagePromptEnglish.result,
            style: config.GENERATE_IMAGE_STYLE,
            sampler_index: 'DPM++ 2M SDE Karras',
            size: '1024x576',
          })
          return (
            <>
              <quote id={session.messageId} />
              <image url={`data:image/png;base64,${imageRes.data[0].b64_image}`} />
              {resp.result}
            </>
          )
        }
        return (
          <>
            <quote id={session.messageId} />
            {resp.result}
          </>
        )
      }
      return (
        <>
          <quote id={session.messageId} />
          对话包含敏感内容
        </>
      )
    })
  // 文生图指令
  if (config.OPEN_IMAGINE_CMD) {
    ctx.command('imagine [prompt:rawtext]', '绘画').action(async ({ session }, prompt: string) => {
      try {
        const resp = await ctx.qianfan.imagine({
          prompt,
          user_id: session.userId,
        })
        let url = 'data:image/png;base64,' + resp.data[0].b64_image
        return (
          <>
            <at id={session.userId} />
            <image url={url} />
          </>
        )
      } catch (error) {
        return '请求错误'
      }
    })
  }
}
