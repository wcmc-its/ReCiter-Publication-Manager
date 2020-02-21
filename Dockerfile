FROM node:12.16.1-alpine as build-stage

#RUN apt-get -y update && apt-get -y upgrade

# Install server dependencies
WORKDIR /usr/src/app
COPY . .
RUN npm install --only=production

# Install client dependencies
# WORKDIR /usr/src/app/client
# RUN npm install --only=production
# RUN npm run build
# RUN mv build/index.html build/app.html
WORKDIR /usr/src/app

EXPOSE 8081
CMD [ "npm", "start" ]