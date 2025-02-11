import TelegramBot from 'node-telegram-bot-api'
import { ADMIN, CHANGE_ID_LITEOFFROAD, MONGO_URL, TESTCHANEL_ID_LITEOFFROAD, CITIES } from './auth/bot.mjs'
import { MongoClient } from 'mongodb'
import { commands, rules1, rules2 } from './const.js'
import cron from 'node-cron'

const client = new MongoClient(MONGO_URL)
await client.connect()
console.log('Connected successfully to db')
const db = client.db('liteoffroad')
const collection = db.collection('points')
const historyCollection = db.collection('historyPoints')
const userCollection = db.collection('users')

const usersMap = {}

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
      cron.schedule('0 15 * * *', () => { //'0 15 * * *'
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
        const profile = await userCollection.findOne({ id: msg.from.id })
        const chatId = msg.chat?.id
        const user = msg?.from.first_name
        const userName = msg?.from.username ? `@${msg?.from.username}` : ''
        const userId = msg?.from.id
        if (!usersMap[chatId]) {
          usersMap[chatId] = {
            username: userName,
            firstName: user,
            userId,
            step: 0,
            point: '',
            coordinates: '',
            comment: '',
            rating: 0,
            install: false,
            photo: '',
            waitingForResponse: false,
            city: profile.city
          }
        }
        usersMap[chatId].city = profile.city
        console.log('userMap', usersMap[chatId])
        console.log('Сообщение: ', msg.text)

        if (!profile && msg.text !== '/start') {
          await this.bot.sendMessage(chatId, `Вам нужно зарегистрироваться, для регистрации нажмите /start`)
          return
        }

        if (profile && profile.banned) {
          await this.bot.sendMessage(chatId, `Вам запрещено пользоваться ботом`)
          return
        }
        if (msg.text === '/points') {
          const cursor = await collection.find({ city: usersMap[chatId].city })
          let i = 0
          const points = []

          for (let data = await cursor.next(); data !== null; data = await cursor.next()) {
            console.log('data', data)
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
            const ratingInfo = install ? `За взятие этой точки вам будет начислен ${rating} ${this.declOfNum(rating, 'балл')}.` : `${installed} получит 2 балла, когда установит эту точку`
            const installedComment = install ? `Установил ${installed}` : `Точку взял ${installed} и еще не установил`
            const takers = point.takers ? point?.takers?.join(', ') : []
            const installedDays = `Точка установлена ${this.getDaysSinceInstallation(point.takeTimestamp)} ${this.declOfNum(this.getDaysSinceInstallation(point.takeTimestamp), 'дней')} назад`
            const text = !takers.length
              ? `<b>${name}</b>\n<code>${coordinates}</code>\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\n${ratingInfo}\n${installedComment}\n${installedDays}\n--------------------------------------`
              : `<b>${name}</b>\n<code>${coordinates}</code>\n${comment}\n<a href="https://yandex.ru/maps/?ll=${second}%2C${first}&mode=search&sll=${first}%${second}&text=${first}%2C${second}&z=15">Посмотреть на карте</a>\n${ratingInfo}\n${installedComment}\nТочку брали, но оставили на месте: ${takers}\n${installedDays}\n--------------------------------------`
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
          await this.defaultData(chatId)
          const profile = await userCollection.findOne({ id: msg.from.id })
          if (!profile) {
            await this.bot.sendMessage(chatId, 'Вы не зарегистрированы в боте, на жмите /start и повторите попытку')
            return
          }
          usersMap[chatId].install = /\/install/i.test(msg.text)
          if (!usersMap[chatId].install) {
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
          usersMap[chatId].step = 1
          return
        }

        if (usersMap[chatId].step === 2 && usersMap[chatId].point && !usersMap[chatId].coordinates) {
          const coordinatesField = /^(\d\d\.\d{4,}, \d\d\.\d{4,})$/i.test(msg.text)
          if (coordinatesField && !usersMap[chatId].coordinates && usersMap[chatId].install) {
            usersMap[chatId].coordinates = msg.text
            usersMap[chatId].step = 3
            await this.bot.sendMessage(chatId, 'Напиши краткий комментарий к точке, например уровень сложности, рекомендации или что-то такое.')
            return
          } else if (!coordinatesField && !usersMap[chatId].coordinates && usersMap[chatId].install) {
            await this.bot.sendMessage(chatId, 'Формат координат неверный, нужно что бы они были в таком формате "60.342349, 30.017123" (без ковычек, просто цифры с запятой посередине). Если хочешь отменить оформление взятия точки, то напиши "отменить"')

            return
          }
        }

        if (usersMap[chatId].point && usersMap[chatId].coordinates && usersMap[chatId].step === 3) {
          if (!usersMap[chatId].comment) {
            usersMap[chatId].comment = msg.text
            usersMap[chatId].step = 4
            await this.bot.sendMessage(chatId, 'Отправь ОДНУ!!! фотографию установки точки')
          }
        }

        if (/^\/profile$/i.test(msg.text)) {
          const id = msg.from.id
          const chatId = msg.from.id
          await this.defaultData(chatId)
          const profile = await userCollection.findOne({ id: id })
          if (profile) {
            const username = msg.from.username
            const firstName = msg.from.first_name
            const rating = profile.rating
            const position = profile.position
            const takePoints = profile.takePoints
            const installPoints = profile.installPoints
            const city = profile.city ? profile.city : 'Город не выбран'
            const text = `Username: ${username}\nИмя аккаунта: ${firstName}\nВаш рейтинг: ${rating}\nВаше место в рейтинге: ${position}\nУстановлено точек: ${installPoints}\nВзято точек: ${takePoints}\nВаш город: ${city}`
            await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' })
          }
        }

        if (/^\/results$/i.test(msg.text)) {
          try {
            const chatId = msg.from.id
            await this.defaultData(chatId)
            const resultUsers = await this.ratingCursor()
            if (!resultUsers.length) {
              await this.bot.sendMessage(chatId, `Еще нет лидеров, игра только началась`)
              return
            }
            let message = '<b>Общие результаты игры</b>'
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
              message += `\n--------------------------------------\n`

              if (resultUsers[i].username) {
                message += `<b>${resultUsers[i]?.position} Место</b> ${username}\n${resultUsers[i].rating} ${this.declOfNum(resultUsers[i].rating, 'балл')}\nВзято точек: ${resultUsers[i].takePoints}\nУстановлено точек: ${resultUsers[i].installPoints}\n${ratingText}`
              } else {
                message += `<b>${resultUsers[i]?.position} Место</b> ${username}\n${resultUsers[i].rating} ${this.declOfNum(resultUsers[i].rating, 'балл')}\nВзято точек: ${resultUsers[i].takePoints}\nУстановлено точек: ${resultUsers[i].installPoints}\n${ratingText}`
              }
            }
            await this.bot.sendMessage(chatId, message, {
              parse_mode: 'HTML',
              disable_notification: true
            })
          } catch (e) {
            console.error('Failed results', e.message)
          }
        }

        if (/^\/archive$/i.test(msg.text)) {
          try {
            const chatId = msg.from.id
            await this.defaultData(chatId)
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
          const chatId = msg.from.id
          await this.defaultData(chatId)
          await this.bot.sendMessage(chatId, rules1, {
            parse_mode: 'HTML',
            disable_notification: true,
            disable_web_page_preview: true
          })
          await this.bot.sendMessage(chatId, rules2, {
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
              installedId: profile.installedId,
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
          const text = `<a href="tg://user?id=477789928">user</a>`
          await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' })
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
          const chatId = msg.from.id
          await this.defaultData(chatId)
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
            await this.bot.sendMessage(chatId, '🏙 Выберите город:', {
              reply_markup: {
                inline_keyboard: CITIES.map(city => [{ text: city, callback_data: `city_${city}` }])
              }
            })
            return
          }
          await this.bot.sendMessage(chatId, 'Вы уже зарегистрированы')
        }

        // help
        if (/\/help/i.test(msg.text)) {
          const chatId = msg.from.id
          await this.defaultData(chatId)
          const userId = usersMap[chatId].userId
          const username = usersMap[chatId].username ? `${usersMap[chatId].username}` : `<a href="tg://user?id=${userId}">${usersMap[chatId].firstName}</a>`
          await this.bot.sendMessage(chatId, `Привет, ${username}! Что случилось? Ваше сообщение будет отправлено в канал @liteoffroad всем пользователям. Отправьте координаты где вы застряли и напишите комментарий. Если позволяет интеренет, то отправьте фото и видео бедствия в комментарии к посту в канале.`, {
            reply_markup: {
              keyboard: [['❌ Отмена']],
              one_time_keyboard: true,
              resize_keyboard: true
            },
            parse_mode: 'HTML'
          })
          usersMap[chatId].waitingForResponse = true
          return
        }
        // help
        if (msg.text === '❌ Отмена' && usersMap[chatId].waitingForResponse) {
          await this.bot.sendMessage(chatId, 'Запрос отменен.', {
            reply_markup: { remove_keyboard: true }
          })
          usersMap[chatId].waitingForResponse = false
        }
        // help
        if (usersMap[chatId].waitingForResponse) {
          const userName = usersMap[chatId].username ? `${usersMap[chatId].username}` : `<a href="tg://user?id=${userId}">${usersMap[chatId].firstName}</a>`

          if (msg.text) {
            // Если пользователь отправил текст
            await this.bot.sendMessage(chatId, 'Ваш запрос отправлен в общий канал @liteoffroad!', {
              reply_markup: { remove_keyboard: true }
            })
            const text = `🚨ВНИМАНИЕ СОС!!!\n ${userName} требуется помощь:\n\n${msg.text}`
            await this.bot.sendMessage(TESTCHANEL_ID_LITEOFFROAD, text, {
              parse_mode: 'HTML'
            })

          }

          // Убираем пользователя из списка ожидания
          usersMap[chatId].waitingForResponse = false
        }

        if (/\/changeCity/i.test(msg.text)) {
          const chatId = msg.from.id
          await this.defaultData(chatId)
          const userCity = await this.getUserCity(chatId)
          console.log('user', user)
          console.log('Ваш город -', userCity)
          await this.bot.sendMessage(chatId, `🏙 Ваш текущий город: \n*${userCity}*\n\nХотите сменить город?`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Да, сменить город', callback_data: 'change_city' }],
                [{ text: 'Нет', callback_data: 'cancel' }]
              ]
            }
          })
        }
      }
    } catch (e) {
      console.log('Failed onMessage', e.message)
    }
  }

  async getUserCity (userId) {
    const user = await userCollection.findOne({ id: userId })
    return user ? user.city : 'Не указан'
  }

  async updateUserCity(userId, city) {
    console.log('updateUserCity', userId, city)
    await userCollection.updateOne({ id: userId }, {
      $set: {
        city: city,
      }
    })
  }

  async onCallback (msg) {
    try {
      const chatId = msg.from.id
      switch (msg.data) {
        case 'tookPoints': { // забрал
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          await collection.updateOne({ point: usersMap[chatId].point }, {
            $set: {
              id: Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000,
              install: usersMap[chatId].install,
              coordinates: usersMap[chatId].install ? usersMap[chatId].coordinates : ',',
              comment: usersMap[chatId].comment,
              photo: usersMap[chatId].photo,
              installed: msg.from.username ? `@${msg.from.username}` : msg.from.first_name,
              installedId: msg.from.id,
              rating: 1,
              takeTimestamp: new Date().getTime(),
              updateTimestamp: new Date().getTime()
            }
          })
          await this.delay(500)
          await this.defaultData(chatId)
          break
        }
        case 'noTookPoints': { // оставил
          const isPoint = await collection.findOne({ point: usersMap[chatId].point })
          const user = msg.from.username ? `@${msg.from.username}` : msg.from.first_name
          const takers = isPoint.takers
          takers.push(user)
          await collection.updateOne({ point: usersMap[chatId].point }, {
            $inc: { rating: 1, },
            $set: { takers: takers }
          })
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id)
          await this.bot.sendMessage(CHANGE_ID_LITEOFFROAD, 'Точку оставили на месте, рейтинг точки повышен на 1', { disable_notification: true })
          await this.defaultData(chatId)
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
        case 'cancel': {
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id).catch(() => {})
          await this.bot.sendMessage(chatId, "👌 Хорошо, ничего не меняем.")
          break
        }
        case 'change_city': {
          await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id).catch(() => {})
          await this.bot.sendMessage(chatId, "Выберите новый город:", {
            reply_markup: {
              inline_keyboard: CITIES.map(city => [{ text: city, callback_data: `city_${city}` }])
            }
          })
          break
        }
      }

      if (msg.data.startsWith("city_")) {
        const newCity = msg.data.replace("city_", "");

        await this.updateUserCity(msg.from.id, newCity);
        await this.bot.deleteMessage(msg.message.chat.id, msg.message.message_id).catch(() => {})
        await this.bot.sendMessage(chatId, `✅ Ваш город успешно обновлен на *${newCity}*!`, { parse_mode: "Markdown" });
      }
    } catch (e) {
      console.log('Failed onMessage', e.message)
    }
  }

  async takePoint (msg, pointText) {
    const chatId = msg.from.id
    if (usersMap[chatId].step === 1 && !usersMap[chatId].point && usersMap[chatId].install) {
      const pointField = /точка [0-9]+/i.test(pointText)
      if (pointField && !usersMap[chatId].point) {
        usersMap[chatId].point = pointText
        const pointInBase = await collection.findOne({ point: pointText })
        if (!pointInBase) {
          await this.bot.sendMessage(chatId, 'Такой точки не существует, возможно вы опечатались')
          return
        }
        if (usersMap[chatId].install && pointInBase.install) {
          await this.bot.sendMessage(chatId, '❗Точка уже установлена, ее сперва нужно взять❗')
          return
        }
        await this.bot.sendMessage(chatId, 'Отлично, теперь отправь координаты. Они должны быть в таком формате (без ковычек, просто цифры с запятой посередине) "60.342349, 30.017123"')
        usersMap[chatId].step = 2
      }
    } else if (usersMap[chatId].step === 1 && !usersMap[chatId].install) {
      usersMap[chatId].point = pointText
      const pointInBase = await collection.findOne({ point: pointText })
      if (!pointInBase) {
        await this.bot.sendMessage(chatId, '❗Такой точки не существует, возможно вы опечатались❗')
        return
      }
      if (!usersMap[chatId].install && !pointInBase.install) {
        await this.bot.sendMessage(chatId, '❗Точка уже взята, ее сперва нужно установить❗')
        return
      }
      const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name

      if ((!usersMap[chatId].install && pointInBase.takers.includes(username)) || (!usersMap[chatId].install && pointInBase.installed === username)) {
        await this.bot.sendMessage(chatId, `❗❗❗Вы уже брали эту точку, нельзя брать точки повторно. Вы сможете снова взять эту точку, только если другой участник ее переставит.❗❗❗`)
        return
      }
      await this.bot.sendMessage(chatId, 'Отправь ОДНУ!!! фотографию взятия точки')
      usersMap[chatId].step = 4
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

      if (updates.length > 0) {
        let hasPositionChanges = false
        let message = '🏆Позиции в рейтинге обновились🏆\n\n'

        for (const update of updates) {
          if (update.positionChanged) {
            hasPositionChanges = true
            console.log('update', update)
            const newLeadUser = update?.username !== null ? `@${update.username}` : `<a href="tg://user?id=${update.id}">${update.firstName}</a>`
            message += `${newLeadUser} теперь на ${update.position} месте \n\n`
            await userCollection.updateOne({ id: update.id }, {
              $set: {
                position: update.position,
                positionTime: update.positionTime,
              }
            })
          }
        }

        if (hasPositionChanges) {
          console.log('Текст refresh rating', message)
          await this.bot.sendMessage(CHANGE_ID_LITEOFFROAD, message, {
            disable_notification: true,
            parse_mode: 'HTML'
          })
        }
      }
    } catch (e) {
      console.error('Failed to refresh rating', e.message)
    }
  }

  async onFile (msg) {
    try {
      const chatId = msg.from.id
      usersMap[chatId].photo = msg.photo[0].file_id
      console.log(this.getTime())
      console.log('msg', msg)
      console.log('photo', usersMap[chatId].photo)
      const username = msg.from.username ? `@${msg.from.username}` : msg.from.first_name
      const pointField = await collection.findOne({ point: usersMap[chatId].point })
      if (usersMap[chatId].step === 4 && usersMap[chatId].photo) {
        const text = usersMap[chatId].install
          ? 'Отлично, этого достаточно. За установку этой точки, тебе начислен 2 балла'
          : `Отлично, этого достаточно. За взятие этой точки, тебе начислен ${pointField.rating} ${this.declOfNum(pointField.rating, 'балл')}`
        await this.bot.sendMessage(chatId, text)
        usersMap[chatId].rating = pointField.rating
      } else {
        return
      }
      const profile = await userCollection.findOne({ id: msg.from.id })
      const text = usersMap[chatId].install
        ? `${usersMap[chatId].point} Установлена!🔥\nКоординаты: <code>${usersMap[chatId].coordinates}</code>\nУстановил: ${username}\n${usersMap[chatId].comment}\nТебе добавлен рейтинг +2\nОбщий рейтинг ${profile.rating + 1}\nСообщение продублировано в основной канал @liteoffroad`
        : `${usersMap[chatId].point} Взята 🔥\n${usersMap[chatId].comment}\nТочку взял: ${username}\nТебе добавлен рейтинг +${usersMap[chatId].rating}\nОбщий рейтинг ${profile.rating + usersMap[chatId].rating}\nСообщение продублировано в основной канал @liteoffroad`

      const textForChanel = usersMap[chatId].install
        ? `${usersMap[chatId].point} Установлена!🔥\nКоординаты: <code>${usersMap[chatId].coordinates}</code>\nУстановил: ${username}\n${usersMap[chatId].comment}\nЕму добавлен рейтинг +2\n<a href="https://point-map.ru/">📍Карта с точками📍</a>`
        : `${usersMap[chatId].point} Взята 🔥\n${usersMap[chatId].comment}\nТочку взял: ${username}\nЕму добавлен рейтинг +${usersMap[chatId].rating}`

      await this.bot.sendPhoto(chatId, usersMap[chatId].photo, {
        caption: text,
        parse_mode: 'HTML',
        disable_notification: true,
        disable_web_page_preview: true
      })
      await this.bot.sendPhoto(CHANGE_ID_LITEOFFROAD, usersMap[chatId].photo, {
        caption: textForChanel,
        parse_mode: 'HTML',
        disable_notification: true,
        disable_web_page_preview: true
      })

      if (pointField) {
        if (usersMap[chatId].install) {
          await historyCollection.insertOne({
            id: pointField.id || Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000,
            point: pointField.point,
            comment: pointField.comment,
            coordinates: pointField.coordinates,
            install: true,
            installed: msg.from.username ? `@${msg.from.username}` : msg.from.first_name,
            installedId: msg.from.id,
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
            installedId: msg.from.id,
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
              rating: usersMap[chatId].install ? 2 : usersMap[chatId].rating,
              installPoints: usersMap[chatId].install ? 1 : 0,
              takePoints: !usersMap[chatId].install ? 1 : 0
            }
          })
          const newCursor = await this.ratingCursor()
          await this.refreshRating(oldCursor, newCursor)
        }

        if (usersMap[chatId].install) {
          await collection.updateOne({ point: usersMap[chatId].point }, {
            $set: {
              id: Math.floor(Math.random() * (10000 - 1000 + 1)) + 1000,
              install: usersMap[chatId].install,
              installed: msg.from.username ? `@${msg.from.username}` : msg.from.first_name,
              installedId: msg.from.id,
              coordinates: usersMap[chatId].install ? usersMap[chatId].coordinates : ',',
              comment: usersMap[chatId].comment,
              photo: usersMap[chatId].photo,
              rating: 1,
              takers: [],
              takeTimestamp: new Date().getTime(),
              updateTimestamp: new Date().getTime()
            }
          })
        }
        if (!usersMap[chatId].install) {
          await this.bot.sendMessage(chatId, `Точка осталась на месте или забрал?`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Оставил', callback_data: 'noTookPoints' }, { text: 'Забрал', callback_data: 'tookPoints' }]
              ]
            }
          })
        } else {
          await this.defaultData(chatId)
        }
      } else {
        await this.bot.sendMessage(chatId, 'Такая точка не найдена')
        await this.defaultData(chatId)
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
  async updatePointsRating () {
    try {
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      const oneWeekAgoTimestamp = oneWeekAgo.getTime()
      const oldCursor = await this.ratingCursor()
      console.log('oneWeekAgoTimestamp', oneWeekAgoTimestamp)

      const filter = {
        updateTimestamp: { $lte: oneWeekAgoTimestamp },
        install: true,
        rating: { $lte: 10 },
        comment: { $ne: 'точку украли' },
        point: { $ne: 'Точка 88' }
      }

      const pointsLastWeekAgo = await collection.find(filter).toArray()

      if (pointsLastWeekAgo.length === 0) {
        console.log('Нет точек для обновления')
        return
      }

      await collection.updateMany(
        filter,
        {
          $inc: { rating: 1 },
          $set: { updateTimestamp: new Date().getTime() },
        }
      )

      let message = '📣Автоматически обновлен рейтинг для следующих точек:📣\n\n'

      for (const point of pointsLastWeekAgo) {
        message += `${point.point}: Новый рейтинг: ${point.rating + 1}\n`
        const user = await userCollection.findOne({ id: point.installedId })
        if (user) {
          console.log('user', user)
          if (!user.banned) {
            await userCollection.updateOne({ id: point.installedId },
              {
                $inc: { rating: 1 }
              }
            )
            message += `Точку устанавливал ${point.installed}, ему добавлен 1 балл\n`
          }
        }
      }
      console.log('Отправляемый текст:', message)
      await this.bot.sendMessage(CHANGE_ID_LITEOFFROAD, message)
      console.log(`[${new Date().toISOString()}] Обновлено точек: ${pointsLastWeekAgo.length}`)

      const newCursor = await this.ratingCursor()
      await this.refreshRating(oldCursor, newCursor)
    } catch (e) {
      console.error(`[${new Date().toISOString()}] Ошибка при обновлении рейтингов:`, e.message)
    }
  }

  // кол-во дней с даты (timestamp)
  getDaysSinceInstallation (timestamp) {
    const currentDate = new Date()
    const installationDate = new Date(timestamp)
    const diffInMs = currentDate - installationDate

    return Math.floor(diffInMs / (1000 * 60 * 60 * 24))
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

  async defaultData (chatId) {
    const profile = await userCollection.findOne({ id: chatId })

    usersMap[chatId] = {
      username: usersMap[chatId].username || '',
      firstName: usersMap[chatId].firstName || '',
      userId: usersMap[chatId].userId || '',
      step: 0,
      point: '',
      coordinates: '',
      comment: '',
      rating: 0,
      install: false,
      photo: '',
      waitingForResponse: false,
      city: profile.city || '',
    }
  }

  stop () {
    if (this.bot) {
      this.bot.stop()
    }
  }
}