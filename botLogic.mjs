import TelegramBot from 'node-telegram-bot-api'
import { MONGO_URL, CHANGE_ID_LITEOFFROAD, ADMIN } from './auth/bot.mjs'
import { MongoClient } from 'mongodb'
import { commands, rules } from './const.js'
import cron from 'node-cron'

const client = new MongoClient(MONGO_URL)
await client.connect()
console.log('Connected successfully to db')
const db = client.db('liteoffroad')
const collection = db.collection('points')
const historyCollection = db.collection('historyPoints')
const userCollection = db.collection('users')

let step = 0
let point = ''
let username = ''
let coordinates = ''
let comment = ''
let rating = 0
let install = false
let photo = ''

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
      console.log('bot started')
      await this.bot.setMyCommands(commands)
      this.bot.on('message', msg => this.onMessage(msg))
      this.bot.on('channel_post', msg => this.onChannelPost(msg))
      this.bot.on('photo', msg => this.onFile(msg))
      this.bot.on('callback_query', msg => this.onCallback(msg))

      // Планируем задачу на каждый день в 15:00
      cron.schedule('0 15 * * *', () => {
        console.log(`[${new Date().toISOString()}] Запуск обновления рейтингов точек...`)
        this.updatePointsRating().then(() => console.log(`[${new Date().toISOString()}] Обновление завершено.`))
      })
    }
  }

  async onChannelPost (msg) {
    console.log('msg', msg)
  }

  async onMessage (msg) {
    try {
      if (msg.text) {
        console.log(this.getTime())
        console.log('msg', msg)
        console.log('step', step)
        console.log('point', point)
        console.log('username', username)
        console.log('coordinates', coordinates)
        console.log('comment', comment)
        console.log('rating', rating)
        console.log('install', install)
        console.log('photo', photo)
        const chatId = msg.chat?.id
        const user = msg?.from.first_name
        const userName = `@${msg?.from.username}`
        const profile = await userCollection.findOne({ id: msg.from.id })

        if (profile && profile.banned) {
          await this.bot.sendMessage(chatId, `Вам запрещено пользоваться ботом`)
          return
        }
        if (msg.text === '/points') {
          const cursor = await collection.find()
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
            if (name === 'Точка 88' && ADMIN !== userName) {
              continue
            }
            const rating = point.rating
            const comment = point.comment

            if (comment === 'точку украли') {
              continue
            }

            const coordinates = point.coordinates
            const first = coordinates?.split(',')[0].trim()
            const second = coordinates?.split(',')[1].trim()
            const photo = point?.photo
            const install = point.install
            const installed = point.installed
            const ratingInfo = install ? `За взятие этой точки вам будет начислен ${rating} ${this.declOfNum(rating, 'балл')}.` : `${installed} получит ${rating} ${this.declOfNum(rating, 'балл')}, когда установит эту точку`
            const installedComment = install ? `Установил ${installed}` : `Точку взял ${installed} и еще не установил`
            const takers = point.takers ? point?.takers?.join(', ') : []
            const text = !takers.length
              ? `<b>${name}</b>\n<code>${coordinates}</code>\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\n${ratingInfo}\n${installedComment}\n--------------------------------------`
              : `<b>${name}</b>\n<code>${coordinates}</code>\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\n${ratingInfo}\n${installedComment}\nТочку брали, но оставили на месте: ${takers}\n--------------------------------------`
            // await this.bot.sendLocation(chatId, first, second)
            if (photo) {
              await this.bot.sendPhoto(chatId, photo, {
                caption: text,
                parse_mode: 'HTML',
                disable_notification: true,
                disable_web_page_preview: true
              })
            } else {
              await this.bot.sendMessage(chatId, text, {
                parse_mode: 'HTML',
                disable_notification: true,
                disable_web_page_preview: true
              })
            }
          }

          // Общая карта всех точек
          await this.bot.sendMessage(chatId, `<a href="https://point-map.ru/">Ссылка на карту со всеми точками</a>`, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        }

        if (msg.text === '/map') {
          await this.bot.sendMessage(chatId, `<a href="https://point-map.ru/">Ссылка на карту со всеми точками</a>`, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        }

        if (/(\/take|\/install)/i.test(msg.text)) {
          this.defaultData()
          const profile = await userCollection.findOne({ id: msg.from.id })
          if (!profile) {
            await this.bot.sendMessage(chatId, 'Вы не зарегистрированы в боте, на жмите /start и повторите попытку')
            return
          }
          install = /\/install/i.test(msg.text)
          if (!install) {
            await this.bot.sendMessage(chatId, 'Супер, давай тогда оформим Взятие точки. Я задам несколько вопросов. Постарайся ответить точно, все таки это супер важная инфа 😎')
          } else {
            await this.bot.sendMessage(chatId, 'Супер, давай тогда оформим Установку точки. Я задам несколько вопросов. Постарайся ответить точно, все таки это супер важная инфа 😎')
          }
          await this.bot.sendMessage(chatId, `Какой номер точки?`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '1', callback_data: 'takePoint1' }, { text: '1 южная', callback_data: 'takePoint1Y' }],
                [{ text: '2 северная', callback_data: 'takePoint2S' }, { text: '2', callback_data: 'takePoint2' }],
                [{ text: '3', callback_data: 'takePoint3' }, { text: '4', callback_data: 'takePoint4' }],
                [{ text: '5', callback_data: 'takePoint5' }, { text: '6', callback_data: 'takePoint6' }],
                [{ text: '7', callback_data: 'takePoint7' }, { text: '8', callback_data: 'takePoint8' }],
                [{ text: '9', callback_data: 'takePoint9' }, { text: '10', callback_data: 'takePoint10' }],
                [{ text: '11', callback_data: 'takePoint11' }, { text: '666', callback_data: 'takePoint666' }],
                [{ text: '88 тестовая', callback_data: 'takePoint88' }]
              ]
            }
          })
          step = 1
          return
        }

        if (step === 2 && point && !coordinates) {
          const coordinatesField = /^(\d\d\.\d{4,}, \d\d\.\d{4,})$/i.test(msg.text)
          if (coordinatesField && !coordinates && install) {
            coordinates = msg.text
            step = 3
            await this.bot.sendMessage(chatId, 'Напиши краткий комментарий к точке, например уровень сложности, рекомендации или что-то такое.')
            return
          } else if (!coordinatesField && !coordinates && install) {
            await this.bot.sendMessage(chatId, 'Формат координат неверный, нужно что бы они были в таком формате "60.342349, 30.017123" (без ковычек, просто цифры с запятой посередине). Если хочешь отменить оформление взятия точки, то напиши "отменить"')

            return
          }
        }

        if (point && coordinates && step === 3) {
          if (!comment) {
            comment = msg.text
            step = 4
            await this.bot.sendMessage(chatId, 'Отправь ОДНУ!!! фотографию установки точки')
          }
        }

        if (/^\/profile$/i.test(msg.text)) {
          const id = msg.from.id
          const profile = await userCollection.findOne({ id: id })
          if (profile) {
            const username = msg.from.username
            const firstName = msg.from.first_name
            const rating = profile.rating
            const position = profile.position
            const takePoints = profile.takePoints
            const installPoints = profile.installPoints
            const text = `Username: ${username}\nИмя аккаунта: ${firstName}\nВаш рейтинг: ${rating}\nВаше место в рейтинге: ${position}\nУстановлено точек: ${installPoints}\nВзято точек: ${takePoints}`
            await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' })
          }
        }

        if (/^\/results$/i.test(msg.text)) {
          try {
            const resultUsers = await this.ratingCursor()
            if (!resultUsers.length) {
              await this.bot.sendMessage(chatId, `Еще нет лидеров, игра только началась`)
              return
            }
            for (let i = 0; i < resultUsers.length; i++) {
              const username = resultUsers[i].username ? `@${resultUsers[i].username}` : `<a href="tg://user?id=${resultUsers[i].id}">${resultUsers[i].firstName}</a>`
              const date = new Date(resultUsers[i].positionTime)
              const now = new Date()
              const diffInMs = now - date
              const daysDiff = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
              const hoursDiff = Math.floor((diffInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
              const minutesDiff = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60))
              const ratingText = daysDiff
                ? `На ${resultUsers[i].position} месте уже ${daysDiff} ${this.declOfNum(daysDiff, 'дней')}, ${hoursDiff} ${this.declOfNum(hoursDiff, 'час')} и ${minutesDiff} ${this.declOfNum(minutesDiff, 'мин')}`
                : hoursDiff
                  ? `На ${resultUsers[i].position} месте уже ${hoursDiff} ${this.declOfNum(hoursDiff, 'час')} и ${minutesDiff} ${this.declOfNum(minutesDiff, 'мин')}`
                  : `На ${resultUsers[i].position} месте уже ${minutesDiff} ${this.declOfNum(minutesDiff, 'мин')}`

              if (resultUsers[i].username) {
                await this.bot.sendMessage(chatId, `${resultUsers[i]?.position} Место ${username}\n${resultUsers[i].rating} ${this.declOfNum(resultUsers[i].rating, 'балл')}\nВзято точек: ${resultUsers[i].takePoints}\nУстановлено точек: ${resultUsers[i].installPoints}\n${ratingText}`, {
                  parse_mode: 'HTML',
                  disable_notification: true
                })
              } else {
                await this.bot.sendMessage(chatId, `${resultUsers[i]?.position} Место ${username}\n${resultUsers[i].rating} ${this.declOfNum(resultUsers[i].rating, 'балл')}\nВзято точек: ${resultUsers[i].takePoints}\nУстановлено точек: ${resultUsers[i].installPoints}\n${ratingText}`, {
                  parse_mode: 'HTML',
                  disable_notification: true
                })
              }
            }
          } catch (e) {
            console.error('Failed results', e.message)
          }
        }

        if (/^\/archive$/i.test(msg.text)) {
          try {
            await this.bot.sendMessage(chatId, 'Раздел в разработке')
            const cursor = await historyCollection.find().limit(30)
            let i = 0
            const points = []

            for (let data = await cursor.next(); data !== null; data = await cursor.next()) {
              i++
              points.push(data)
            }
            await this.bot.sendMessage(chatId, `<b>Привет ${user}!\nВот список последних 30 архивных точек:</b>`, { parse_mode: 'HTML' })
            await this.delay(2000)

            // Архивные Точки
            for (const archivePoint of points) {
              const name = archivePoint.point
              if (name === 'Точка 88' && ADMIN !== userName) {
                continue
              }
              const rating = archivePoint.rating
              const comment = archivePoint.comment
              const coordinates = archivePoint.coordinates
              const first = coordinates?.split(',')[0].trim()
              const second = coordinates?.split(',')[1].trim()
              const photo = archivePoint?.photo
              const install = archivePoint.install
              const installed = archivePoint.installed
              const id = ADMIN === userName ? `                  id: ${archivePoint.id}` : ''
              const ratingInfo = `За взятие этой точки было начислено ${rating} ${this.declOfNum(rating, 'балл')}.`
              const installedComment = install ? `Установил ${installed}` : `Точку взял ${installed}`
              const date = new Date(archivePoint.takeTimestamp)
              const dateComment = install ? `Точка была установлена ${date.getFullYear()} - ${date.getMonth() + 1} - ${date.getDate()}` : `Точка была взята ${date.getFullYear()} - ${date.getMonth() + 1} - ${date.getDate()}`
              const historyTakers = archivePoint.takers?.join(', ')
              const text = !historyTakers
                ? `<b>${name}</b>${id}\n<code>${coordinates}</code>\n${dateComment}\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\n${ratingInfo}\n${installedComment}\n--------------------------------------`
                : `<b>${name}</b>${id}\n<code>${coordinates}</code>\n${dateComment}\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\n${ratingInfo}\n${installedComment}\nТочку брали, но оставили на месте: ${historyTakers}\n--------------------------------------`
              // await this.bot.sendLocation(chatId, first, second)
              if (photo) {
                await this.bot.sendPhoto(chatId, photo, {
                  caption: text,
                  parse_mode: 'HTML',
                  disable_notification: true,
                  disable_web_page_preview: true
                })
              }
            }
          } catch (e) {
            console.log('Faled Archive', e)
          }
        }

        if (msg.text === '/rules') {
          await this.bot.sendMessage(chatId, rules, {
            parse_mode: 'HTML',
            disable_notification: true,
            disable_web_page_preview: true
          })
        }

        // ADMIN
        if (/вернуть \d+/i.test(msg.text) && ADMIN === userName) {
          const backPoint = msg.text.split(' ')[1].trim()
          await this.bot.sendMessage(chatId, `Возвращаю точку id: ${backPoint}`)
          const profile = await historyCollection.findOne({ id: parseInt(backPoint) })
          console.log('backPoint', backPoint)
          console.log('profile', profile)
          if (!profile) {
            await this.bot.sendMessage(chatId, 'Точка с таким id не найдена')
            return
          }
          await collection.updateOne({ point: profile.point }, {
            $set: {
              id: Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000,
              install: !profile.install,
              coordinates: profile.coordinates,
              comment: profile.comment,
              photo: profile.photo,
              installed: profile.installed,
              rating: profile.rating,
              takeTimestamp: profile.takeTimestamp,
              updateTimestamp: profile.updateTimestamp
            }
          })
          // todo Сделать коррекцию рейтинга при переносе
          await this.bot.sendMessage(chatId, 'Готово')
        }

        if (/правка/i.test(msg.text) && ADMIN === userName) {
          // выполнить какое нибудь действие админом
        }

        if (/забанить /i.test(msg.text) && ADMIN === userName) {
          const banUser = msg.text.split(' ')[1].trim()
          await userCollection.updateOne({ username: banUser }, { $set: { 'banned': true } })
          await this.bot.sendMessage(chatId, `Пользователь ${banUser} забанен`)
        }
        if (/разбанить /i.test(msg.text) && ADMIN === userName) {
          const banUser = msg.text.split(' ')[1].trim()
          await userCollection.updateOne({ username: banUser }, { $set: { 'banned': false } })
          await this.bot.sendMessage(chatId, `Пользователь ${banUser} разбанен`)
        }

        if (/^\/start$/i.test(msg.text)) {
          const text = `Привет. Это бот для игры "Застрянь друга" от команды Liteoffroad\nВ разделах меню ты найдешь всю необходимую информацию.\nПо техническим вопросам работы бота писать @skaman91\nУдачи 😉`
          await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' })
          const username = msg.from.username
          const firstName = msg.from.first_name
          const id = msg.from.id
          const profile = await userCollection.findOne({ id: id })
          if (!profile) {
            await userCollection.insertOne({
              id: id,
              firstName: firstName,
              username: username,
              rating: 0,
              position: 0,
              positionTime: new Date().getTime(),
              takePoints: 0,
              installPoints: 0,
              banned: false
            })
            await this.bot.sendMessage(chatId, 'Вы успешно зарегистрированы')
          }
          await this.bot.sendMessage(chatId, 'Вы уже зарегистрированы')
        }

      }
    } catch (e) {
      console.log('Failed onMessage', e.message)
    }
  }

  async onCallback (msg) {
    try {
      switch (msg.data) {
        case 'tookPoints': { // забрал
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          await collection.updateOne({ point: point }, {
            $set: {
              id: Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000,
              install: install,
              coordinates: install ? coordinates : ',',
              comment: comment,
              photo: photo,
              installed: msg.from.username ? `@${msg.from.username}` : msg.from.first_name,
              rating: 1,
              takeTimestamp: new Date().getTime(),
              updateTimestamp: new Date().getTime()
            }
          })
          await this.delay(500)
          this.defaultData()
          break
        }
        case 'noTookPoints': { // оставил
          const isPoint = await collection.findOne({ point: point })
          const user = msg.from.username ? `@${msg.from.username}` : msg.from.first_name
          const takers = isPoint.takers
          takers.push(user)
          await collection.updateOne({ point: point }, { $inc: { rating: 1, }, $set: { takers: takers } })
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          await this.bot.sendMessage(CHANGE_ID_LITEOFFROAD, 'Точку оставили на месте, рейтинг точки повышен на 1', { disable_notification: true })
          break
        }
        case 'takePoint1': {
          await this.takePoint(msg, 'Точка 1')
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          break
        }
        case 'takePoint1Y': {
          await this.takePoint(msg, 'Точка 1 южная')
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          break
        }
        case 'takePoint2S': {
          await this.takePoint(msg, 'Точка 2 северная')
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          break
        }
        case 'takePoint2': {
          await this.takePoint(msg, 'Точка 2')
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          break
        }
        case 'takePoint3': {
          await this.takePoint(msg, 'Точка 3')
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          break
        }
        case 'takePoint4': {
          await this.takePoint(msg, 'Точка 4')
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          break
        }
        case 'takePoint5': {
          await this.takePoint(msg, 'Точка 5')
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          break
        }
        case 'takePoint6': {
          await this.takePoint(msg, 'Точка 6')
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          break
        }
        case 'takePoint7': {
          await this.takePoint(msg, 'Точка 7')
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          break
        }
        case 'takePoint8': {
          await this.takePoint(msg, 'Точка 8')
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          break
        }
        case 'takePoint9': {
          await this.takePoint(msg, 'Точка 9')
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          break
        }
        case 'takePoint10': {
          await this.takePoint(msg, 'Точка 10')
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          break
        }
        case 'takePoint11': {
          await this.takePoint(msg, 'Точка 11')
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          break
        }
        case 'takePoint666': {
          await this.takePoint(msg, 'Точка 666')
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          break
        }
        case 'takePoint88': {
          await this.takePoint(msg, 'Точка 88')
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          break
        }
      }
    } catch (e) {
      console.log('Failed onMessage', e.message)
    }
  }

  async takePoint (msg, pointText) {
    const chatId = msg.from.id
    if (step === 1 && !point && install) {
      const pointField = /точка [0-9]+/i.test(pointText)
      if (pointField && !point) {
        point = pointText
        const pointInBase = await collection.findOne({ point: pointText })
        if (!pointInBase) {
          await this.bot.sendMessage(chatId, 'Такой точки не существует, возможно вы опечатались')
          return
        }
        if (install && pointInBase.install) {
          await this.bot.sendMessage(chatId, '❗Точка уже установлена, ее сперва нужно взять❗')
          return
        }
        await this.bot.sendMessage(chatId, 'Отлично, теперь отправь координаты. Они должны быть в таком формате (без ковычек, просто цифры с запятой посередине) "60.342349, 30.017123"')
        step = 2
      }
    } else if (step === 1 && !install) {
      point = pointText
      const pointInBase = await collection.findOne({ point: pointText })
      if (!pointInBase) {
        await this.bot.sendMessage(chatId, '❗Такой точки не существует, возможно вы опечатались❗')
        return
      }
      if (!install && !pointInBase.install) {
        await this.bot.sendMessage(chatId, '❗Точка уже взята, ее сперва нужно установить❗')
        return
      }
      const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name

      if ((!install && pointInBase.takers.includes(username)) || (!install && pointInBase.installed === username)) {
        await this.bot.sendMessage(chatId, `❗❗❗Вы уже брали эту точку, нельзя брать точки повторно. Вы сможете снова взять эту точку, только если другой участник ее переставит.❗❗❗`)
        return
      }
      await this.bot.sendMessage(chatId, 'Отправь ОДНУ!!! фотографию взятия точки')
      step = 4
    }
  }

  async ratingCursor () {
    const result = []
    const cursor = await userCollection.find({ rating: { $gt: 0 } })
      .sort({
        rating: -1,
        position: 1,
        installPoints: -1,
        takePoints: -1
      })
    for (let data = await cursor.next(); data !== null; data = await cursor.next()) {
      result.push(data)
    }
    return result
  }

  async refreshRating (oldCursor, newCursor) {
    try {
      const newMap = {}

      // Создаем мапу из нового массива
      newCursor.forEach((user, index) => {
        newMap[user._id] = { index, rating: user.rating }
      })

      const updates = []

      // Если oldCursor пустой - добавляем всех как новых
      if (oldCursor.length === 0) {
        newCursor.forEach((user, index) => {
          user.position = index + 1       // Устанавливаем позицию
          user.positionTime = new Date().getTime()  // Устанавливаем текущее время для новых пользователей
          updates.push(user)
        })
      } else {
        // Сравниваем и обновляем данные
        const oldMap = {}
        oldCursor.forEach(user => {
          oldMap[user._id] = user
        })
        //
        console.log('oldMap', oldMap)
        console.log('newMap', newMap)

        oldCursor.forEach((user, index) => {
          const newUser = newMap[user._id]

          if (newUser) {
            let updated = false
            // Обновляем позицию, если она изменилась
            if (newUser.index !== index) {
              user.position = newUser.index + 1  // Позиция начинается с 1
              user.positionTime = new Date().getTime()     // Обновляем только при изменении позиции
              user.positionChanged = true
              updated = true
            }

            // Обновляем рейтинг, если он изменился
            if (user.rating !== newUser.rating) {
              user.rating = newUser.rating
              updated = true
            }

            if (updated) {
              updates.push(user)
            }
          }
        })

        // Добавляем новых пользователей, которых нет в oldCursor
        newCursor.forEach((user, index) => {
          if (!oldMap[user._id]) {
            user.position = index + 1
            user.positionTime = new Date().getTime()
            user.positionChanged = true
            updates.push(user)
          }
        })
      }

      console.log('updates', updates)
      if (updates.length > 0) {
        let message = '🏆Позиции в рейтинге обновились🏆\n\n'

        for (const update of updates) {
          if (update.positionChanged) {
            console.log('update', update)
            const newLeadUser = update?.username !== null ? `@${update.username}` : `[${update.firstName}](tg://user?id=${update.id})`
            message += `${newLeadUser} теперь на ${update.position} месте \n\n`
          }
        }
        await this.bot.sendMessage(CHANGE_ID_LITEOFFROAD, message, {
          disable_notification: true,
          parse_mode: 'Markdown'
        })

        for (let user of updates) {
          await userCollection.updateOne({ id: user.id }, {
            $set: {
              position: user.position,
              positionTime: user.positionTime,
            }
          }, { upsert: true })  // Добавляем upsert для новых пользователей
        }
      }
    } catch (e) {
      console.error('Failed to refresh rating', e.message)
    }
  }

  async onFile (msg) {
    try {
      photo = msg.photo[0].file_id
      console.log(this.getTime())
      console.log('msg', msg)
      console.log('photo', photo)
      const chatId = msg.from.id
      const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name
      const pointField = await collection.findOne({ point: point })
      if (step === 4 && photo) {
        const text = install
          ? 'Отлично, этого достаточно. За установку этой точки, тебе начислен 2 балла'
          : `Отлично, этого достаточно. За взятие этой точки, тебе начислен ${pointField.rating} ${this.declOfNum(pointField.rating, 'балл')}`
        await this.bot.sendMessage(chatId, text)
        rating = pointField.rating
      } else {
        return
      }
      const profile = await userCollection.findOne({ id: msg.from.id })
      const text = install
        ? `${point} Установлена!🔥\nКоординаты: <code>${coordinates}</code>\nУстановил: ${username}\n${comment}\nТебе добавлен рейтинг +2\nОбщий рейтинг ${profile.rating + 1}\nСообщение продублировано в основной канал @liteoffroad`
        : `${point} Взята 🔥\n${comment}\nТочку взял: ${username}\nТебе добавлен рейтинг +${rating}\nОбщий рейтинг ${profile.rating + rating}\nСообщение продублировано в основной канал @liteoffroad`

      const textForChanel = install
        ? `${point} Установлена!🔥\nКоординаты: <code>${coordinates}</code>\nУстановил: ${username}\n${comment}\nЕму добавлен рейтинг +2`
        : `${point} Взята 🔥\n${comment}\nТочку взял: ${username}\nЕму добавлен рейтинг +${rating}`

      await this.bot.sendPhoto(chatId, photo, {
        caption: text,
        parse_mode: 'HTML',
        disable_notification: true,
        disable_web_page_preview: true
      })
      await this.bot.sendPhoto(CHANGE_ID_LITEOFFROAD, photo, {
        caption: textForChanel,
        parse_mode: 'HTML',
        disable_notification: true,
        disable_web_page_preview: true
      })

      if (pointField) {
        if (install) {
          await historyCollection.insertOne({
            id: pointField.id || Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000,
            point: pointField.point,
            comment: pointField.comment,
            coordinates: pointField.coordinates,
            install: true,
            installed: msg.from.username ? `@${msg.from.username}` : msg.from.first_name,
            photo: pointField.photo,
            rating: pointField.rating,
            takers: pointField.takers,
            takeTimestamp: new Date().getTime(),
            updateTimestamp: new Date().getTime()
          })
        } else {
          await historyCollection.insertOne({
            id: pointField.id || Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000,
            point: pointField.point,
            comment: pointField.comment,
            coordinates: pointField.coordinates,
            install: false,
            installed: msg.from.username ? `@${msg.from.username}` : msg.from.first_name,
            photo: pointField.photo,
            rating: pointField.rating,
            takers: pointField.takers,
            takeTimestamp: new Date().getTime(),
            updateTimestamp: new Date().getTime()
          })
        }

        if (msg.from.id) {
          const oldCursor = await this.ratingCursor()
          await userCollection.updateOne({ id: msg.from.id }, {
            $inc: {
              rating: install ? 2 : rating,
              installPoints: install ? 1 : 0,
              takePoints: !install ? 1 : 0
            }
          })
          const newCursor = await this.ratingCursor()
          await this.refreshRating(oldCursor, newCursor)
        }

        if (install) {
          await collection.updateOne({ point: point }, {
            $set: {
              id: Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000,
              install: install,
              installed: msg.from.username ? `@${msg.from.username}` : msg.from.first_name,
              coordinates: install ? coordinates : ',',
              comment: comment,
              photo: photo,
              rating: 1,
              takers: [],
              takeTimestamp: new Date().getTime(),
              updateTimestamp: new Date().getTime()
            }
          })
        }
        if (!install) {
          await this.bot.sendMessage(chatId, `Точка осталась на месте или забрал?`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Оставил', callback_data: 'noTookPoints' }, { text: 'Забрал', callback_data: 'tookPoints' }]
              ]
            }
          })
        } else {
          this.defaultData()
        }
      } else {
        await this.bot.sendMessage(chatId, 'Такая точка не найдена')
        this.defaultData()
      }
    } catch (e) {
      console.log('Failed onFile', e.message)
    }
  }

  delay (minDelay, maxDelay) {
    const timeout = maxDelay ? ~~((minDelay + (maxDelay - minDelay) * Math.random())) : minDelay

    return new Promise(resolve => setTimeout(resolve, timeout))
  }

  // Получение текущей даты и времени
  getTime () {
    const currentTime = new Date()
    currentTime.setHours(currentTime.getHours() + 3)

    const day = String(currentTime.getDate()).padStart(2, '0')
    const month = String(currentTime.getMonth() + 1).padStart(2, '0')
    const year = currentTime.getFullYear()
    const hours = String(currentTime.getHours()).padStart(2, '0')
    const minutes = String(currentTime.getMinutes()).padStart(2, '0')
    const seconds = String(currentTime.getSeconds()).padStart(2, '0')

    return `${day}.${month}.${year} - ${hours}:${minutes}:${seconds}`
  }

  // Обновляем точки, которые не переставили в течение недели
  async updatePointsRating() {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      const oneWeekAgoTimestamp = oneWeekAgo.getTime()
      console.log('oneWeekAgoTimestamp', oneWeekAgoTimestamp)

      const filter = {
        updateTimestamp: { $lte: oneWeekAgoTimestamp },
        install: true,
        rating: { $lte: 10 }
      }

      const pointsLastWeekAgo = await collection.find(filter).toArray()

      if (pointsLastWeekAgo.length === 0) {
        console.log('Нет точек для обновления')
        return
      }

      const result = await collection.updateMany(
        { updateTimestamp: { $lte: oneWeekAgoTimestamp } }, // Условие: lastUpdated старше одной недели
        {
          $inc: { rating: 1 },
          $set: { updateTimestamp: new Date().getTime() }
        }
      )

      let message = '📣Автоматически обновлен рейтинг для следующих точек:📣\n\n'

      pointsLastWeekAgo.forEach((point) => {
        message += `${point.point}: Новый рейтинг: ${point.rating + 1}\n`
      })

      await this.bot.sendMessage(CHANGE_ID_LITEOFFROAD, message)
      console.log(`[${new Date().toISOString()}] Обновлено точек: `)
    } catch (e) {
      console.error(`[${new Date().toISOString()}] Ошибка при обновлении рейтингов:`, e.message)
    }
  }

  declOfNum (number, label) {
    const labels = {
      'балл': ['балл', 'балла', 'баллов'],
      'час': ['час', 'часа', 'часов'],
      'мин': ['минуту', 'минуты', 'минут'],
      'дней': ['день', 'дня', 'дней']
    }

    const map = labels[label]

    if (!map) {
      return label
    }

    const cases = [2, 0, 1, 1, 1, 2]

    return map[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]]
  }

  defaultData () {
    step = 0
    point = ''
    username = ''
    coordinates = ''
    comment = ''
    rating = 0
    install = false
    photo = ''
  }

  stop () {
    if (this.bot) {
      this.bot.stop()
    }
  }
}