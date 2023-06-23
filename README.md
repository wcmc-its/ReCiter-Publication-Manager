# ReCiter Publication Manager

![Build Status](https://codebuild.us-east-1.amazonaws.com/badges?uuid=eyJlbmNyeXB0ZWREYXRhIjoiSFBQdHVsYW1rMTltMGN6bG1iNFhrdC9sb3pyZzVGYU92THRaVTlNSENWV1RaUllNZEZpWVA4RDNnRlBINzdQeDdONDQxSjExWm9uRVVZcGRRSkVhVUw0PSIsIml2UGFyYW1ldGVyU3BlYyI6ImhsSmlRVTZvTTI2aWdrNFciLCJtYXRlcmlhbFNldFNlcmlhbCI6MX0%3D&branch=master)
![version](https://img.shields.io/badge/version-0.1alpha-blue.svg?maxAge=2592000)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![Pending Pull-Requests](https://img.shields.io/github/issues-pr-raw/wcmc-its/ReCiter-Publication-Manager.svg?color=blue)](https://github.com/wcmc-its/ReCiter-Publication-Manager/pulls)
[![Closed Pull-Requests](https://img.shields.io/github/issues-pr-closed-raw/wcmc-its/ReCiter-Publication-Manager.svg?color=blue)](https://github.com/wcmc-its/ReCiter-Publication-Manager/pulls)
[![GitHub issues open](https://img.shields.io/github/issues-raw/wcmc-its/ReCiter-Publication-Manager.svg?maxAge=2592000)](https://github.com/wcmc-its/ReCiter-Publication-Manager/issues)
[![GitHub issues closed](https://img.shields.io/github/issues-closed-raw/wcmc-its/ReCiter-Publication-Manager.svg?maxAge=2592000)](https://github.com/wcmc-its/ReCiter-Publication-Manager/issues)
[![Tags](https://img.shields.io/github/tag/wcmc-its/ReCiter-Publication-Manager.svg?style=social)](https://github.com/wcmc-its/ReCiter-Publication-Manager/releases)
[![Github All Releases](https://img.shields.io/github/downloads/wcmc-its/ReCiter-Publication-Manager/total.svg)]()

ReCiter Publication Manager is a powerful web application that streamlines the process of updating and reporting on the publications of an institution's scholars. Publication Manager is the front end user interface within the ReCiter suite of applications. In addition to the requirements for the application itself, you will need to minimally install the following: 
- [ReCiter](https://github.com/wcmc-its/ReCiter) - a machine learning-based publication recommendation engine which provides high quality suggestions for individuals of interest
- [ReCiterDB](https://github.com/wcmc-its/ReCiterDB) - the back end data store for Publication Manager; in addition to the schema and stored procedures, this repository contains a set of scripts that retrieve data from ReCiter and imports them into this MySQL database
- [ReCiter PubMed Retrieval Tool](https://github.com/wcmc-its/reciter-pubmed-Retrieval-Tool/) - An application which provides an API which sits on top of PubMed's eFetch web service. Generally speaking, this API provides some basic inferences and makes the PubMed data easier to work with.

See the [Functionality](#functionality) section to see screencaps and animations of ReCiter Publication Manager in action.


![https://github.com/wcmc-its/ReCiter/blob/master/files/howreciterworks.png](https://github.com/wcmc-its/ReCiter/blob/master/files/howreciterworks.png)


- [Technical](#technical)
  - [Prerequisites](#prerequisites)
  - [Technological stack](#technological-stack)
  - [Installation](#installation)
  - [Stopping and removing an instance](#stopping-and-removing-an-instance)
  - [Installation as a development box](#installation-as-a-development-box)
  - [Making changes in the development box](#making-changes-in-the-development-box)
  - [Starting the app](#starting-the-app)
- [Functionality](#functionality)
  - [Access](#access)
    - [Authentication](#authentication)
    - [Access roles](#access-roles)
  - [Curating](#curating)
    - [For individuals](#for-individuals)
    - [For groups](#for-groups)
  - [Reporting](#reporting)
    - [Searching for people](#searching-for-people)
    - [Filters](#filters)
    - [Output results](#output-results)
    - [Generating a bibliometric report](#generating-a-bibliometric-report)
- [Funding acknowledgment](#funding-acknowledgment)










## Technical


### Prerequisites

Requirements for Publication Manager itself:

1. Install Docker
   1. Go to the [Docker website](https://hub.docker.com)
   2. If you don't already have an account, you will need to create one.
   3. Use the Docker image to download and install Docker
   4. To verify Docker is installed, execute `docker ps` at the command line
1. Install `Node`
   1. Enter `brew install node`
   2. For more, see [here](https://www.dyclassroom.com/howto-mac/how-to-install-nodejs-and-npm-on-mac-using-homebrew).

Publication Manager is part of the ReCiter suite of applications. In addition to the above, you will need to install and set up the following: 
- [ReCiter](https://github.com/wcmc-its/ReCiter) - a machine learning-based publication recommendation engine 
- [ReCiterDB](https://github.com/wcmc-its/ReCiterDB) - the back end data store for Publication Manager; this repository also includes a set of scripts that retrieve data from ReCiter and imports them into this MySQL database
- [ReCiter PubMed Retrieval Tool](https://github.com/wcmc-its/reciter-pubmed-Retrieval-Tool/) - An API on top of PubMed's eFetch web service. Generally speaking, this API makes the PubMed data easier to work with.


### Technological stack

- **Next.js** - an open-source web development framework created by Vercel enabling React-based web applications with server-side rendering and generating static websites.
- **ReactJS** - a front-end JavaScript library for building user interfaces based on components
- **NodeJS** - a cross-platform, open-source server environment
- **Sequelize** - a modern TypeScript and Node.js object relational mapping (ORM) for MySQL and MariaDB



### Installation

1. Clone the repository to a local folder using `git clone https://github.com/wcmc-its/ReCiter-Publication-Manager.git`
1. In Terminal, navigate to local directory where the repository is installed
1. Enter `docker build -t reciter/pub-manager .`
1. Update local.js
   1. Navigate to `directory/config/local.js`.
   1. Update the endpoint with appropriate endpoint for ReCiter and Reciter-Pubmed. (For local development mode, follow instructions in the "Installation as a development box" section.)
   1. If you are using Docker to run the project then you must not specify `localhost` for hostname. Since the container does not understand the DNS entry. See [Connect to services running on host from within Docker container](https://stackoverflow.com/a/43541732)
   1. If you are using Windows machine use your machine IP for hostname or `host.docker.internal` for hostname
   1. If you are using Mac use `docker.for.mac.host.internal` for hostname 
   1. Add your adminApiKey.
   1. Save the file. 
1. Enter `docker run -d -p 8081:8081 --name <container-name> reciter/pub-manager`
1. Let's see what is happening in the logs as we make changes to our application. 
   1. You can check the container details using - 
   1. Enter `docker ps`
   1. The console will return return a range of attributes for the instance. Look for the "NAMES" column in these attributes. It should  be the container name you provided: `reciter_pub_manager` 
   1. Enter `docker logs -f -t reciter_pub_manager` where `reciter_pub_manager` is the name of your container.
1. Go to your browser and enter `https://localhost:8081/login`
1. To login, enter your username and password. You can setup username and password using the reciter api 
`http://<reciter-endpoint>:<port-number>/swagger-ui.html#/re-citer-pub-manager-controller/createUserUsingPOST`


### Stopping and removing an instance

1. Go to Terminal and enter `docker stop reciter_pub_manager` where `reciter_pub_manager` is the name of your instance. 
2. Enter `docker rm reciter_pub_manager`.


### Installation as a development box

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
1. Enter `npm run dev` This will run the nodejs express server in development mode and also the react server concurrently.
1. If you get an error because a port is already in use, you need to do the following.
   1. Interrupt the existing process by entering control-C.
   1. Identify the existing PID. Enter `lsof -f :5000`
   1. Enter `kill -9 41046` where 41046 is the PID of the existing process.
1. This should open a new tab in your default browser.
1. Add `/login` to URL as in `https://localhost:3000/login`
1. Try logging in.


### Making changes in the development box

1. Open your repository in Visual Studio Code or your tool of choice.
1. Navigate to `/client/src/css`
1. Open Header.css and change background-color to #ff6600, and save the file.
1. The changes should instantly appear in Chrome.


### Starting the app
 
First, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.




## Functionality




### Access




#### Populating users

Application users are stored in the `admin_users` table in ReCiterDB. There are two options for adding and updating users:

- **Manual** - To add or update users manually, superusers can go to the web interface and navigate to `Manage module > Manage users`. From there, they can add or update users as needed.
- **Programmatic** - If you have configured ReCiterDB and its associated scripts, users should automatically be populated in the `person` table and added to the `admin_users` table. To configure this option, you will need to follow the setup instructions for ReCiterDB and ensure that the associated scripts are running as intended. Once this is set up, users should be added or updated in the `admin_users` table automatically.



#### Authentication

ReCiter Publication Manager supports two options for authentication:

**Option #1: Local login** - This option allows users to log in to Publication Manager using a local username and password.

**Option #2: SAML-based login** - This option is designed to meet institutional security requirements by allowing Publication Manager to work with SAML and an institution's identity provider. During SAML authentication, the identity provider provides a payload that contains a `personIdentifier` attribute, which is always populated, and sometimes contains a `user.email` attribute. Publication Manager [attempts](https://github.com/wcmc-its/ReCiter-Publication-Manager/blob/master/src/pages/index.js) to match the `user.email` attribute against the email address recorded in the `admin_users` table. If this fails, it attempts to match against the `personIdentifier`.





#### Access Roles

To utilize the Publication Manager, users must have specific access roles assigned to them. The access roles available and their corresponding privileges are as follows:

| Role | Privileges | Relevant to | How assigned |
| --- | --- | --- | --- |
| **Curator (Individual)** | Update publication lists for oneself | Faculty and individual authors | Automatically assigned |
| **Curator (Department)** | Update publication lists for everyone in an organization unit | Departmental administrators and staff | Manually assigned by superuser |
| **Curator (All)** | Update publication lists for everyone | Librarians | Manually assigned by superuser |
| **Reporter** | Generate reports about everyone | Departmental administrators and staff | Manually assigned by superuser |
| **Superuser** | Do all of the above and update roles of others | System administrators | Manually assigned by superuser |

Role assignments are stored in the `admin_users_roles` table.




### Curating

The publication lists for the ~6,000 or so key people of interest (e.g., full-time faculty) are curated by WCM librarians every business day. Other types of users such as NYP residents and PhD alumni have profiles that are curated less frequently.

In the event of an error or omission, faculty and departmental users may wish to update these lists through curation.

#### For individuals

- If you are a faculty or other user with a profile:
  - You will be directed to your profile upon login.
- If you do not have a profile:
  - Click on the "Find people" tab.
  - Enter the name or person identifier (e.g., NetID, CWID, etc.) of the person you are searching for.
  - Click on the "Curate publications" button
      
![Find people](/files/FindPeople.png)


- Publications are divided into three categories:
  - **Suggested** - publications for which authorship has neither been accepted nor rejected; these are generally publications suggested by the machine learning algorithm behind ReCiter
  - **Accepted** - publications by a user for which they have affirmed authorship
  - **Rejected** - publications by a user for which they have denied authorship

- Reviewing accepted publications:
  - The "Matching Score" gives a general idea of how likely the ReCiter algorithm believes a  publication was written by our person of interest.
  - If you are uncertain, expand the "Show evidence behind the suggestion." This will show you why the score is what it is. For example, sometimes a person is on a grant and that person's name has shown up as a co-author on a suggested article.
  - You can also judge if the "Inferred keywords" at the top of the page are consistent with the topic of the article of interest.
  - After you accept or reject a publication, you can choose to "Refresh suggestions." It may take up to a minute to use the feedback you provided to re-score all the candidate records.

![Individual curation](/files/IndividualCuration.gif)
    

**Searching PubMed**

- Sometimes the ReCiter engine behind Publication Manager fails to find the correct candidate publications. In that case, you can search for them using the "Add New Record: PubMed" link on the right of the page
- In this screen, you can input any search term you would in PubMed. This includes topics, author names, and a list of PMIDs (PubMed identifiers).
- The application will show a maximum of 100 results. It won't show any records that have already been accepted or rejected.
    

![Searching PubMed](/files/SearchingPubMed.png)



#### For groups

Here's how you curate the publication lists for a group of individuals:

- Enter a list of person identifiers in the "Name or NetID(s)" input box. Or, filter by Organizational Unit, Institution, and/or Person Type(s). You should be able to enter up to 200 person identifiers. Note that a search for "Medicine" won't get results for someone whose primary organizational unit is "Medicine (Cardiology)." You would have to select the parent department and all the subsuming divisions.
- Click on the "Curate publications" button.
- The user interface will display a sequence of individuals who need to have pending publications to be reviewed.
    
![Bulk curation](/files/BulkCuration.gif)



### Reporting

Data for reporting is refreshed on a nightly basis. Any curation work performed during the day won't appear until early the next morning.

#### Searching for people

If you are reporting on the publication output of a person, you can do it in two ways:

1. One by one
   1. Click the "Create Reports" tab.
   1. In the "Author" filter, limit by name or NetID.
   1. Click the "Search" button.
   1. Check the corresponding box next to the user's name.
1. For people that satisfy certain criteria.
   1. Click the "Create Reports" tab.
   1. In the "Authors" filter, limit by name, organizational units, institution, person type, and/or author position.
   1. Click the "Search" button.
1. For a known group of NetIDs (see animation below)
   1. Click on the "Find People" tab.
   1. Paste in a list of NetIDs. (This has been tested to reliably work for up to 200 NetIDs.)
   1. Click the "Search" button.
   1. Click the "Create Reports" button above the table of results.
   1. You will be directed to the "Create Reports" page with all the authors with those NetIDs checked.
    
![Bulk reporting](/files/BulkReporting2.gif)

#### Filters

The Filters section of the Publication Manager allows users to narrow down the article results displayed. The following filters are available for people:

- **Author** - Filter by name or NetID. 
- **Organization** - Refers to a given person's primary organizational unit. Publication Manager uses parentheses to indicate that a person is a member of both a unit and a sub-unit. For example, a search for "Medicine" will also return results for someone whose primary organizational unit is "Medicine (Cardiology)." 
- **Institution** - Refers to a person's primary institutional affiliation (e.g., `Cornell University`).
- **Person Type(s)** - Refers to an individual's designation (e.g., `academic-faculty`, `student-phd`).
- **Author Position** - Indicates whether any of the selected people were first and/or last author on a given publication. In some cases, certain authors may be co-first or co-last. These cases are not tracked automatically but can be added to an override table called `analysis_override_author_position`. Such authorships will get credit for being first or last author, both here and in the bibliometric report described below.

The following filters are available for articles:

- **Date** - Refers to the date an article was added to PubMed, which can be several months different from the publication date. By default, the last 30 days is selected.
- **Type** - Refers to the type of article, such as Case Report, Editorial, Review, etc. Articles of type "Academic Article" generally describe original research.
- **Journal** - Refers to the verbose journal name (e.g., "Annual Review of Cell Biology").
- **Journal Rank** - Refers to the [Scimago journal ranking](https://www.scimagojr.com/), which is not the same as the journal impact factor but correlates highly with that metric. Journal Impact Factor is not published on the website due to copyright reasons. However, it is available when a user downloads a CSV file.

![Filters](/files/Filters.png)



#### Output results
- Export to CSV
  - Option #1: Export authorships. (See below.) An authorship is a case where a NetID has been assigned by a human to an author on a given publication. One publication may have up to dozens of known authorships. 
  - Option #2: Export articles. An article-level report.
   
![Export CSV](/files/ExportCSV.gif)


- Export to RTF
  - RTF is a Word-compatible document. In cases where one or more authors has been selected, those names are bolded.
    

![Export to RTF](/files/ExportRTF2.gif)


#### Generating a bibliometric report

Here's how to generate a narrative bibliometric summary (see sample) of a full-time faculty at Weill Cornell Medicine. The summary includes h-index, h5-index, NIH-provided article-level bibliometrics, a ranking of an individual's most impactful publications, and a summary statement.

1. Go to "Create reports"
1. Search for an author (e.g., "Lyden, David)
1. In the results, click on the author's name.
1. A modal window appears.
1. Click on the "Generate bibliometric report" button.
1. This will download a bibliometric summary (see below) which you can open up in Word. 
    
![Bibliometric report](/files/BibliometricReport.gif)





#### Settings

The Publication Manager's configuration settings can be accessed and modified by superusers through the user interface by visiting `Manage module >> Settings`. All changes made in the web interface will automatically update for all users.

The available settings are:

- **Labels for terms** - The value to be displayed in the application for all users (e.g. NetID vs. CWID vs. UserID...)
- **Help text for users** - The contents of an "on hover" event that provides in-page documentation to users
- **Inclusion of attributes** - The decision to include attributes such as citation count in the output of an article CSV, authorship CSV, on the web page itself, or as a sortable attribute
- **Order of output attributes** - Allows admins to decide the order in which attributes are displayed, including in the CSV outputs, the web interface, and sort function
- **Maximum records output** - The maximum number of records that can be output to the CSV files



## Funding acknowledgment

Publication Manager has been funded by:
- Lyrasis through its Catalyst fund
- National Library of Medicine, National Institutes of Health under a cooperative agreement with Region 7

The ReCiter suite of applications has been funded by the following:
- The National Institutes of Health National Center for Advancing Translational Sciences through grant number UL1TR002384 



## Learn more

Please submit any questions to [Paul Albert](mailto:paa2013@med.cornell.edu) or publications@med.cornell.edu. You may expect a response within one to two business days. 

We use GitHub issues to track bugs and feature requests. If you find a bug, please feel free to open an issue.

Contributions welcome!
