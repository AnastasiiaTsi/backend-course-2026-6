# використовуємо node
FROM node:18

# робоча папка
WORKDIR /app

# копіюємо package
COPY package*.json ./

# встановлюємо залежності
RUN npm install

# копіюємо все інше
COPY . .

# порт
EXPOSE 3000

# запуск
CMD ["node", "server.js"]