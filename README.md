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

Publication Manager also integrates with [ReCiter PubNotifier](https://github.com/wcmc-its/ReCiter-PubNotifier) which utlizes AWS Lambda to enhance the publication notification process within academic environments. It automates notifications to faculty regarding new academic publications, whether accepted or in-review, and integrates with ReCiter Publication Manager and ReCiterDB.

See the [Functionality](#functionality) section to see screencaps and animations of ReCiter Publication Manager in action.


![https://github.com/wcmc-its/ReCiter/blob/master/files/howreciterworks.png](https://github.com/wcmc-its/ReCiter/blob/master/files/howreciterworks.png)


- [Technical](#technical)
  - [Prerequisites](#prerequisites)
  - [Technological stack](#technological-stack)
  - [Installation guide](#installation-guide)
    - [Initial setup](#initial-setup)
    - [Setting up native authentication](#setting-up-native-authentication)
    - [Docker commands for troubleshooting](#docker-commands-for-troubleshooting)    
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
  - [Configuration](#configuration)
- [Funding acknowledgment](#funding-acknowledgment)




# Technical


## Prerequisites

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


## Technological stack

- **Next.js** - an open-source web development framework created by Vercel enabling React-based web applications with server-side rendering and generating static websites.
- **ReactJS** - a front-end JavaScript library for building user interfaces based on components
- **NodeJS** - a cross-platform, open-source server environment
- **Sequelize** - a modern TypeScript and Node.js object relational mapping (ORM) for MySQL and MariaDB





## Installation guide

This guide details the steps for setting up the application locally, through AWS ECS, and as a development box for making and testing changes.

### Initial setup

1. **Clone the repository:**
   Clone the repository to your local machine using the command:
```
git clone https://github.com/wcmc-its/ReCiter-Publication-Manager.git
```

2. **Build the Docker image:**
Navigate to the cloned directory and build the Docker image:
sudo docker build -t reciter-pub-manager .

Confirm the image creation by listing all Docker images:

```
sudo docker images
```


3. **Check and stop containers:** Verify no containers are running on port 3000 and stop them if necessary:
```
sudo docker ps -q --filter "publish=3000"
sudo docker stop <container ID>
```

4. **Environment variables setup:**
Configure the environment variables following the instructions in the [environmental variables wiki](https://github.com/wcmc-its/ReCiter-Publication-Manager/wiki/Environmental-variables-for-ReCiter-Publication-Manager). Use "env.local" for local setups and AWS Secrets Manager for AWS ECS setups.

5. **Run the Docker container:**
Start the Docker container, mapping the desired port (e.g., 5001 to 3000):
```
sudo docker run -d -p 5001:3000 --env-file env.local reciter-pub-manager:latest
```


### Setting up native authentication

To use native authentication for initial testing:

1. **Create a New User:** Utilize the ReCiter API to create a new user with the necessary details, which creates an entry in the `ApplicationUser` table.

2. **Login:** Access the ReCiter Publication Manager login page and log in to create a record in the `admin_users` table.

3. **Update Roles:** Modify roles by adding a new row in the `admin_users_roles` table with the userID and `roleID` as "1" for superuser privileges.

4. **Access the Application:** Navigate to the application by logging in through the specified port on your local machine.

### Docker commands for troubleshooting

- **View Docker logs:**
To check the logs for troubleshooting:
```
sudo docker logs <<Container ID/Container Name>>
docker logs -f -t reciter-pub-manager
```


- **Stopping and removing instances:**
If needed, stop and remove Docker instances using:
```
docker stop reciter-pub-manager
docker rm reciter-pub-manager
```


### Installation as a development box

To set up a development environment for making and testing changes:

1. **Install Dependencies:**
 Install application and client dependencies, including NodeJS and React Redux.

2. **Run Publication Manager:**
 Use `npm run dev` to start both the NodeJS express server and the React server concurrently. Address any port conflicts as necessary.

3. **Access the Application:**
 The application should automatically open in your default browser. Log in through the `/login` page.

### Making changes in the development box

For real-time changes and testing:

1. **Modify CSS:**
 Example: Change the `Header.css` background-color to `#ff6600` and observe instant updates in the browser.

### Starting the app

To start the development server:

```bash
npm run dev
# or
yarn dev
```

Access the app at `http://localhost:5001` and start editing. API routes can be explored and modified as described.






# Functionality




## Access




### Populating users

Application users are stored in the `admin_users` table in ReCiterDB. There are two options for adding and updating users:

- **Manual** - To add or update users manually, superusers can go to the web interface and navigate to `Manage module > Manage users`. From there, they can add or update users as needed.
- **Programmatic** - If you have configured ReCiterDB and its associated scripts, users should automatically be populated in the `person` table and added to the `admin_users` table. To configure this option, you will need to follow the setup instructions for ReCiterDB and ensure that the associated scripts are running as intended. Once this is set up, users should be added or updated in the `admin_users` table automatically.



### Authentication

ReCiter Publication Manager supports two options for authentication:

**Option #1: Local login** - This option allows users to log in to Publication Manager using a local username and password.

**Option #2: SAML-based login** - This option is designed to meet institutional security requirements by allowing Publication Manager to work with SAML and an institution's identity provider. During SAML authentication, the identity provider provides a payload that contains a `personIdentifier` attribute, which is always populated, and sometimes contains a `user.email` attribute. Publication Manager [attempts](https://github.com/wcmc-its/ReCiter-Publication-Manager/blob/master/src/pages/index.js) to match the `user.email` attribute against the email address recorded in the `admin_users` table. If this fails, it attempts to match against the `personIdentifier`.





### Access roles

To utilize the Publication Manager, users must have specific access roles assigned to them. The access roles available and their corresponding privileges are as follows:

| Role | Privileges | Relevant to | How assigned |
| --- | --- | --- | --- |
| **Curator (Individual)** | Update publication lists for oneself | Faculty and individual authors | Automatically assigned |
| **Curator (Department)** | Update publication lists for everyone in an organization unit | Departmental administrators and staff | Manually assigned by superuser |
| **Curator (All)** | Update publication lists for everyone | Librarians | Manually assigned by superuser |
| **Reporter** | Generate reports about everyone | Departmental administrators and staff | Manually assigned by superuser |
| **Superuser** | Do all of the above and update roles of others | System administrators | Manually assigned by superuser |

Role assignments are stored in the `admin_users_roles` table.




## Curating

The publication lists for the ~6,000 or so key people of interest (e.g., full-time faculty) are curated by WCM librarians every business day. Other types of users such as NYP residents and PhD alumni have profiles that are curated less frequently.

In the event of an error or omission, faculty and departmental users may wish to update these lists through curation.

### For individuals

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



### For groups

Here's how you curate the publication lists for a group of individuals:

- Enter a list of person identifiers in the "Name or NetID(s)" input box. Or, filter by Organizational Unit, Institution, and/or Person Type(s). You should be able to enter up to 200 person identifiers. Note that a search for "Medicine" won't get results for someone whose primary organizational unit is "Medicine (Cardiology)." You would have to select the parent department and all the subsuming divisions.
- Click on the "Curate publications" button.
- The user interface will display a sequence of individuals who need to have pending publications to be reviewed.
    
![Bulk curation](/files/BulkCuration.gif)



## Reporting

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

### Filters

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



### Output results
- Export to CSV
  - Option #1: Export authorships. (See below.) An authorship is a case where a NetID has been assigned by a human to an author on a given publication. One publication may have up to dozens of known authorships. 
  - Option #2: Export articles. An article-level report.
   
![Export CSV](/files/ExportCSV.gif)


- Export to RTF
  - RTF is a Word-compatible document. In cases where one or more authors has been selected, those names are bolded.
    

![Export to RTF](/files/ExportRTF2.gif)


### Generating a bibliometric report

Here's how to generate a narrative bibliometric summary (see sample) of a full-time faculty at Weill Cornell Medicine. The summary includes h-index, h5-index, NIH-provided article-level bibliometrics, a ranking of an individual's most impactful publications, and a summary statement.

1. Go to "Create reports"
1. Search for an author (e.g., "Lyden, David)
1. In the results, click on the author's name.
1. A modal window appears.
1. Click on the "Generate bibliometric report" button.
1. This will download a bibliometric summary (see below) which you can open up in Word. 
    
![Bibliometric report](/files/BibliometricReport.gif)





## Configuration

The Publication Manager's configuration settings can be accessed and modified by superusers through the user interface by visiting `Configuration`. All changes made in the web interface will automatically update for all users.

The available settings are:

- **Labels for terms** - The value to be displayed in the application for all users (e.g. NetID vs. CWID vs. UserID...)
- **Help text for users** - The contents of an "on hover" event that provides in-page documentation to users
- **Inclusion of attributes** - The decision to include attributes such as citation count in the output of an article CSV, authorship CSV, on the web page itself, or as a sortable attribute
- **Order of output attributes** - Allows admins to decide the order in which attributes are displayed, including in the CSV outputs, the web interface, and sort function
- **Maximum records output** - The maximum number of records that can be output to the CSV files
- **Headshot** - The full URL for a third party headshot API
- **Email notifications** - Ability to email out notifications to scholars when they have newly accepted or suggested publications.
- **Automatic role assignment** - Users who login can automatically be assigned a reporter_all or curator_all role.



# Funding acknowledgment

Publication Manager has been funded by:
- Lyrasis through its Catalyst fund
- National Library of Medicine, National Institutes of Health under a cooperative agreement with Region 7

The ReCiter suite of applications has been funded by the following:
- The National Institutes of Health National Center for Advancing Translational Sciences through grant number UL1TR002384 



# Learn more

Please submit any questions to [Paul Albert](mailto:paa2013@med.cornell.edu) or publications@med.cornell.edu. You may expect a response within one to two business days. 

We use GitHub issues to track bugs and feature requests. If you find a bug, please feel free to open an issue.

Contributions welcome!
