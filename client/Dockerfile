FROM node:12-slim as build
WORKDIR /app
ENV PATH /app/node_modules/.bin:$PATH
COPY package.json /app/package.json
# To handle 'not get uid/gid'
RUN npm config set unsafe-perm true

RUN npm install --silent
RUN npm install react-scripts@3.3.0 -g --silent
COPY . /app
RUN npm run build
RUN mv build/index.html build/app.html

# production environment
FROM nginx:latest
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
