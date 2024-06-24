import TelegramBot from 'node-telegram-bot-api'
import mongoose, { Mongoose } from 'mongoose'
import { DB } from './auth/bot.mjs'
import { MongoClient } from 'mongodb'
import { commands } from './const.js'

const url = 'mongodb+srv://skaman93:kadha7-Qyrrit-hisfer@cluster0.qn6jtl9.mongodb.net/?'
const client = new MongoClient(url)
await client.connect()
console.log('Connected successfully to db')
const db = client.db('liteoffroad')
const collection = db.collection('points')
const userCollection = db.collection('users')

let step = 0
let point = ''
let username = ''
let coordinates = ''
let comment = ''
let rating = 0
let install = false

export default class BotLogic {
  constructor ({
    apiToken
  }) {
    this.apiToken = apiToken
    this.bot = null
  }

  async start () {
    if (!this.bot) {
      this.bot = new TelegramBot(this.apiToken, { polling: true })
      console.log('bot', this.bot)
      this.bot.setMyCommands(commands)
      this.bot.on('message', msg => this.onMessage(msg))
      this.bot.on('photo', msg => this.onFile(msg))
    }
  }

  async onMessage (msg) {
    try {
      if (msg.text) {
        console.log(msg)
        const chatId = msg.chat?.id
        const user = msg?.from.first_name
        if (/^(точки|\/points)$/i.test(msg.text)) {
          const cursor = await collection.find({rating: 1})
          let i = 0
          const points = []

          for (let data = await cursor.next(); data !== null; data = await cursor.next()) {
            i++
            points.push(data)
          }
          await this.bot.sendMessage(chatId, `<b>Привет ${user}!\nВот список актуальных точек:</b>`, { parse_mode: 'HTML' })

          // Точки
          for (const point of points) {
            const name = point.point
            const rating = point.rating
            const comment = point.comment
            const coordinates = point.coordinates
            const first = coordinates.split(',')[0].trim()
            const second = coordinates.split(',')[1].trim()
            const photo = point.photo
            const install = point.install ? 'Установлена' : 'Точка взята и еще не установлена'
            const installed = point.installed
            const installedComment = install ? `Установил @${installed}` : `Точку взял @${installed} и еще не установил`
            const text = `<b>${name}</b>\n<code>${coordinates}</code>\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\nЗа взятие этой точки вам будет начислен ${rating} балл.\n${installedComment}\n--------------------------------------`
            await this.bot.sendPhoto(chatId, photo)
            await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML', disable_web_page_preview: true })
          }

          // Общая карта всех точек
          await this.bot.sendMessage(chatId, `<a href="https://yandex.ru/maps/?ll=30.260584%2C60.190150&mode=usermaps&source=constructorLink&um=constructor%3A835749c06de950dec11aa07d7999866ffd93035133cdbd7b81c7baa0238778ed&z=11.09">Ссылка на карту со всеми точками</a>`, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })

        }

        if (/карта|\/map$/i.test(msg.text)) {
          await this.bot.sendMessage(chatId, `<a href="https://yandex.ru/maps/?ll=30.260584%2C60.190150&mode=usermaps&source=constructorLink&um=constructor%3A835749c06de950dec11aa07d7999866ffd93035133cdbd7b81c7baa0238778ed&z=11.09">Ссылка на карту со всеми точками</a>`, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        }

        if (/((взял|установил) точку)|(\/take|\/install_point)/i.test(msg.text)) {
          install = /установил точку|\/install_point/i.test(msg.text)
          if (!install) {
            await this.bot.sendMessage(chatId, 'Супер, давай тогда оформим Взятие точки. Я задам несколько вопросов. Постарайся ответить точно, все таки это супер важная инфа 😂')
          } else {
            await this.bot.sendMessage(chatId, 'Супер, давай тогда оформим Установку точки. Я задам несколько вопросов. Постарайся ответить точно, все таки это супер важная инфа 😂')
          }
          await this.bot.sendMessage(chatId, 'Напиши номер точки. Например "точка 5" или "Северная точка 1" или "Кастомная точка 666"')
          step = 1
          return
        }

        if (step === 1 && !point && install) {
          const pointField = /точка [0-9]+/i.test(msg.text)
          if (pointField && !point) {
            point = msg.text
            await this.bot.sendMessage(chatId, 'Отлично, теперь отправь координаты, постарайся что бы они были в таком формате (без ковычек, просто цифры с запятой посередине) "60.342349, 30.017123" ')
            step = 2
            return
          }
        } else if (step === 1 && !install) {
          point = msg.text
          await this.bot.sendMessage(chatId, 'Отправь одну фотографию взятия точки')
          console.log('point', point)
          step = 4
        }

        if (step === 2 && point && !coordinates) {
          const coordinatesField = /(\d+\.\d{4,}, \d+\.\d{4,})/i.test(msg.text)
          if (coordinatesField && !coordinates && install) {
            coordinates = msg.text
            step = 3
            await this.bot.sendMessage(chatId, 'Напиши краткий комментарий к точке, например уровень сложности, рекомендации или что-то такое.')
            return
          } else if (!coordinatesField && !coordinates && install) {
            await this.bot.sendMessage(chatId, 'Формат координат не верный, нужно что бы они были в таком формате "60.342349, 30.017123" (без ковычек, просто цифры с запятой посередине). Если хочешь отменить оформление взятия точки, то напиши "отменить"')

            return
          }
        }

        if (point && coordinates && step === 3) {
          if (!comment) {
            comment = msg.text
            step = 4
            await this.bot.sendMessage(chatId, 'Отправь одну фотографию установки точки')
          }
        }

        if (/^\/profile$/i.test(msg.text)) {
          const id = msg.from.id
          const profile = await userCollection.findOne({ id: id} )
          if (profile) {
            const username = msg.from.username
            const firstName = msg.from.first_name
            const rating = profile.rating
            const takePoints = profile.takePoints
            const installPoints = profile.installPoints
            const text = `Username: ${username}\nИмя аккаунта: ${firstName}\nВаш рейтинг: ${rating}\nУстановлено точек: ${installPoints}\nВзято точек: ${takePoints}`
            await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML'})
          }
        }

        if (/^\/results$/i.test(msg.text)) {
          await this.bot.sendMessage(chatId, 'Раздел в разработке')

        }
        if (/^\/start$/i.test(msg.text)) {
          const username = msg.from.username
          const firstName = msg.from.first_name
          const id = msg.from.id
          const rating = 0
          const takePoints = 0
          const installPoints = 0
          const profile = await userCollection.findOne({ id: id} )
          if (!profile) {
            await userCollection.insertOne({
              id: id,
              firstName: firstName,
              username: username,
              rating: rating,
              takePoints: takePoints,
              installPoints: installPoints,
            })
            await this.bot.sendMessage(chatId, 'Вы успешно зарегистрированы')
          }
        }
      }
    } catch (e) {
      console.log('Failed onMessage', e.message)
    }
  }

  async onFile (msg) {
    try {
      const file = msg.photo[0].file_id
      const chatId = msg.from.id
      if (step === 4 && file) {
        await this.bot.sendMessage(chatId, 'Отлично, этого достаточно. За установку этой точки, тебе начислен один балл))')
        rating = 1
        step = 5
      } else {
        return
      }

      const text = install
        ? `${point} Установлена!🔥\nКоординаты: <code>${coordinates}</code>\nУстановил: @${msg.from.username}\n${comment}\nТебе добавлен рейтинг +${rating}\nОбщий рейтинг 100500`
        : `${point} Взята 🔥\n${comment}\nТочку взял: @${msg.from.username}\nТебе добавлен рейтинг +${rating}\nОбщий рейтинг 100500`
      await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' })
      await this.bot.sendPhoto(chatId, file)
      const pointField = await collection.findOne({ point: point })
      if (pointField) {
        await collection.updateOne({point: point}, {$set: {
            coordinates: coordinates,
            comment: comment,
            install: install,
            installed: msg.from.username,
            photo: file,
          }})
        await userCollection.updateOne({username: msg.from.username},{$inc: {
            rating: rating,
            installPoints: install ? 1 : 0,
            takePoints: !install ? 1 : 0
          }})
      } else {
        await this.bot.sendMessage(chatId, 'Такая точка не найдена')
      }


      step = 0
      point = ''
      username = ''
      coordinates = ''
      comment = ''
      rating = 0
    } catch (e) {
      console.log('Failed onFile', e.message)
    }
  }

  delay (minDelay, maxDelay) {
    const timeout = maxDelay ? ~~((minDelay + (maxDelay - minDelay) * Math.random())) : minDelay

    return new Promise(resolve => setTimeout(resolve, timeout))
  }

  stop () {
    if (this.bot) {
      this.bot.stop()
    }
  }
}