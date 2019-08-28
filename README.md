# ReCiter Publication Manager

ReCiter Publication Manager is a front end user interface for providing feedback to [ReCiter](https://github.com/wcmc-its/reciter/). Users are displayed a set of suggested, accepted, and rejected publications. User feedback in Publication Manager will update the evidence scores of suggested publications in DynamoDB. Feedback will also appear in the various APIs ReCiter uses to share publication data.


## Installation

1. If you haven't done so already, install Node and Docker.
   1. Install Docker
     1. Go to the [Docker website](https://hub.docker.com)
     1. If you don't already have an account, you will need to create one.
     1. Use the Docker image to download and install Docker
     1. To verify Docker is installed, execute `docker ps` at the command line
   1. Install Node
     1. Enter `brew install node`
     1. For more, see [here](https://www.dyclassroom.com/howto-mac/how-to-install-nodejs-and-npm-on-mac-using-homebrew).
1. Clone the repository to a local folder using `git clone https://github.com/wcmc-its/ReCiter-Publication-Manager.git`
1. In Terminal, navigate to local directory where the repository is installed
1. Enter `docker build -t reciter/pub-manager .`
1. Navigate to local directory/config/local.js and update the endpoint with appropriate endpoint for reciter and reciter pubmed and save the file. `Note - use localhost for local development mode or follow instructions for hostname below`
   1. If you are using docker to run the project then you must not specify `localhost` for hostname. Since the container does not understand the DNS entry. See [Connect to services running on host from within Docker container](https://stackoverflow.com/a/43541732)
   1. If you are using Windows machine use your machine IP for hostname or `host.docker.internal` for hostname
   1. If you are using Mac use `docker.for.mac.host.internal` for hostname 
1. Enter `docker run -d -p 8081:8081 --name <container-name> reciter/pub-manager`
1. Let's see what is happening in the logs as we make changes to our application. 
   1. You can check the container details using - 
   1. Enter `docker ps`
   1. The console will return return a range of attributes for the instance. Look for the "NAMES" column in these attributes. It should look be the container name you provided
```
NAMES
reciter_pub_manager
```
   1. Enter `docker logs -f -t reciter_pub_manager` where `reciter_pub_manager` is the name of your container.
1. Go to your browser and enter `https://localhost:8081/login`
1. To login, enter your username and password. You can setup username and password using the reciter api http://<reciter-endpoint>:<port-number>/swagger-ui.html#/re-citer-pub-manager-controller/createUserUsingPOST


## Stopping and removing an instance

1. Go to Terminal and enter `docker stop boring_chandrasekhar` where `boring_chandrasekhar` is the name of your instance. 
2. Enter `docker rm boring_chandrasekhar`.


## Installation as a development box

These steps allow us to make and test out changess locally. We're going to run our front end application on port 3000 (using React Redux) and have it talk to a back end app (using NodeJS), which runs on port 5000.



1. Let's install the application dependencies including nodeJS.
   1. In Terminal, navigate to the local directory where the repository is installed.
   1. Enter `npm i`.
1. Next, let's install the client dependencies including the React Redux dependencies.
   1. Enter `cd client`
   1. Enter `npm i`.
1. We now want to run Publication Manager and trigger the application to automatically restart any time code changes are detected.
   1. Go to the `Publication-Manager` directory. Enter `..`
   1. Enter `npm i -g  node-dev`.
1. Enter `npm run dev`
1. If you get an error because a port is already in use, you need to do the following.
   1. Interrupt the existing process by entering control-C.
   1. Identify the existing PID. Enter `lsof -f :5000`
   1. Enter `kill -9 41046` where 41046 is the PID of the existing process.
1. Let's start our React app as a development server.
1. Open a new tab in Terminal.
1. Enter `cd client`
1. Enter `npm start`
1. If you get an error because the port is already in use, you need to do the following.
   1. The error message should provide you with the PID number.
   1. Open a new tab.
   1. Enter `kill -9 40766` where 40766 is the PID.
   1. Return to the previous tab.
   1. Enter Control-C
   1. Enter `npm start` again.
   1. Alternatively, you can use a new port.
1. This should open a new tab in your default browser.  
1. Try logging in.


## Making changes in the development box

1. Open your repository in Visual Studio Code or your tool of choice.
1. Navigate to `/client/src/css`
1. Open Header.css and change background-color to #ff6600, and save the file.
1. The changes should instantly appear in Chrome.
