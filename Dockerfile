# Stage 1: Build
FROM node:22-alpine AS builder
RUN apk add --no-cache git
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV APP_ENV=production
ENV APP_NAME="Apree CRM Messenger"
ENV APP_TITLE="Apree Messenger"
ENV BASE_URL=https://tg.apree-tech.com
ENV TELEGRAM_API_ID=33759952
ENV TELEGRAM_API_HASH=433f31a36acc80bccec9de95ccedc29b
RUN npm run build:production

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
