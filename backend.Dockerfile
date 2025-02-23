FROM node:23-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
EXPOSE 7070
CMD ["npm", "run", "dev"]
