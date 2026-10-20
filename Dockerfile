FROM node:20-alpine
WORKDIR /app
COPY . .
ENV NODE_ENV=production PORT=3000 TZ=Asia/Jakarta
EXPOSE 3000
CMD ["node", "server.js"]
