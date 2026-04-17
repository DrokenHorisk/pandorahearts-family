# frontend/Dockerfile
FROM node:20-alpine AS build

WORKDIR /app
COPY package.json .
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

# ✅ On injecte la conf SPA
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Vite => dist
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]