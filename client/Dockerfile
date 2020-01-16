FROM node:12.2.0-alpine as build
WORKDIR /app
ENV PATH /app/node_modules/.bin:$PATH
COPY package.json /app/package.json
RUN npm install --silent
RUN npm install react-scripts@3.0.1 -g --silent
COPY . /app
RUN npm run build
RUN mv build/index.html build/app.html

# production environment
FROM nginx:alpine
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 81
CMD ["nginx", "-g", "daemon off;"]