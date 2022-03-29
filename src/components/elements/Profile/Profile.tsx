import React, { useEffect, useState, MouseEvent } from "react";
import { useDispatch, useSelector, RootStateOrAny } from "react-redux";
import { identityFetchData } from "../../../redux/actions/actions";
import { Modal, Container, Row, Button, Col } from "react-bootstrap";
import Image from 'next/image'
import Loader from "../Common/Loader";
import fullName from "../../../utils/fullName";
import styles from "./Profile.module.css";
import { reciterConfig } from '../../../../config/local';

interface PrimaryName {
  firstInitial?: string,
  firstName?: string,
  lastName?: string,
  middleName?: string,
  middleInitial?: string,
}

interface TableRow {
  name: string,
  tag?: string,
}

const imageLoader = ({ src, width, quality }) => {
  return src;
}

const Profile = ({ 
  uid,
  modalShow,
  handleShow,
  handleClose,
 } : {
   uid: string,
   modalShow: boolean,
   handleShow: (e: MouseEvent<HTMLButtonElement>) => void,
   handleClose: () => void,
 }) => {
  const dispatch = useDispatch()
  const relationshipsDisplayed = 10;
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [identity, setIdentity] = useState<any>({});
  const [showBiblioBtn, isShowBiblioBtn] = useState<boolean>(false);
  const formatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction'})

  useEffect(() => {
    if (modalShow) {
     setIsLoading(true);
     const fetchIdentityPromise = fetchIdentity();
     const showBiblioAnalysisPromise = showBiblioAnalysis();
     Promise.all([fetchIdentityPromise, showBiblioAnalysisPromise]).then(() => { setIsLoading(false); })
    }
  }, [modalShow])

  const fetchIdentity = async () => {
    return await fetch('/api/reciter/getidentity/' + uid, {
      credentials: "same-origin",
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Authorization': reciterConfig.backendApiKey
      }
    })
      .then(response => {
        if (response.status === 200) {
          return response.json()
        } else {
          throw {
            type: response.type,
            title: response.statusText,
            status: response.status,
            detail: "Error occurred with api " + response.url + ". Please, try again later "
          }
        }
      })
      .then(data => {
        setIdentity(data.identity);
      })
      .catch(error => {
        console.log(error)
        setIsError(true);
      })
  }

  const showBiblioAnalysis = async () => {
    return await fetch('/api/db/reports/bibliometric-analysis/show-button/' + uid, {
      credentials: "same-origin",
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Authorization': reciterConfig.backendApiKey
      }
    }).then(response => {
      if (response.status === 200) {
        return response.json()
      } else {
        throw {
          type: response.type,
          title: response.statusText,
          status: response.status,
          detail: "Error occurred with api " + response.url + ". Please, try again later "
        }
      }
    })
    .then(data => {
      isShowBiblioBtn(data);
    })
    .catch(error => {
      console.log(error)
      setIsError(true);
    })
  }

  const generateBiblioAnalysis = () => {
    fetch('/api/db/reports/bibliometric-analysis/' + uid, {
      credentials: "same-origin",
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Authorization': reciterConfig.backendApiKey
      }
    })
      .then(response => {
        return response.blob();
      })
      .then(fileBlob => {
        let fileName = uid + ".rtf";
        var link = document.createElement('a')  // once we have the file buffer BLOB from the post request we simply need to send a GET request to retrieve the file data
        link.href = window.URL.createObjectURL(fileBlob)
        link.download = fileName;
        link.click()
        link.remove();
      })
      .catch(error => {
        console.log(error)
        setIsError(true);
        setIsLoading(false);
      })
  }

  const DisplayName = ({ name } : { name: PrimaryName}) => {
    let formattedName = fullName(name);
    return (
      <h2>{formattedName}</h2>
    )
  }

  const DisplayRelationships = ({
    relationships,
    defaultNumber
  } : {
    relationships: string[],
    defaultNumber: number,
  }) => {
    const [displayAll, setDisplayAll] = useState<boolean>(false);

    let fullList = relationships.reduce((rel, acc, i) => [rel, acc].join(i === relationships.length - 1 ? '' : ', '));
    let defaultList = relationships.slice(0, defaultNumber).reduce((rel, acc, i) => [rel, acc].join(', '));
    if (displayAll) {
      return (
        <p>{fullList}</p>
      )
    } else {
      return (
        <p>
          {defaultList}
          {" "}
          {relationships.length > defaultNumber ? <span className={styles.textButton} onClick={() => setDisplayAll(true)}>Show more</span> : ''}
        </p>
      )
    }
  }

  const TableRows = ({ list }) => {
    let rows = [];

    let nameRow = {title: 'Names', values: []};
    if (list.primaryName) {
      let formattedName = fullName(list.primaryName);
      nameRow = { ...nameRow, values: [{name: formattedName, tag: 'Primary'}]}
    }

    if (list.alternateNames) {
      list.alternateNames.forEach((alternateName) => {
        let formattedName = fullName(alternateName);
        nameRow = { ...nameRow, values: [...nameRow.values, {name: formattedName}]}
      })
    }

    rows.push(nameRow)

    if (list.organizationalUnits) {
      let units = [];
      list.organizationalUnits.forEach((unit) => {
        let formattedUnitData: TableRow = { name: unit.organizationalUnitLabel}
        let formattedDate = '';
        if (unit.startDate) {
          formattedDate = unit.startDate.split('-')[0];
          if (unit.endDate) {
            formattedDate = formattedDate + ' - ' + unit.endDate.split('-')[0];
          } else {
            formattedDate = formattedDate + ' - ' + 'Present';
          }
        }
        if (formattedDate !== '') {
          formattedUnitData = {...formattedUnitData, tag: formattedDate};
        }
        units.push(formattedUnitData);
      })
      let orgUnitRow = { title: 'Organizational units', values: units}
      rows.push(orgUnitRow)
    }

    if (list.degreeYear) {
      let degreeYears = []
      if (list.degreeYear.bachelorYear !== 0) {
        degreeYears.push({ name: list.degreeYear.bachelorYear + ' - Bachelor\'s'})
      }
      if (list.degreeYear.doctoralYear !== 0) {
        degreeYears.push({ name: list.degreeYear.doctoralYear + ' - PhD'})
      }
      if (degreeYears.length > 0) {
        rows.push({ title: 'Degrees', values: degreeYears})
      }
    }

    if (list.institutions) {
      if (list.institutions.length > 0) {
        let institutions = [];
        // remove duplicates
        let uniqueInstitutions = list.institutions.filter((institution, index) => {
          return list.institutions.indexOf(institution) !== index
        });
        uniqueInstitutions.forEach((institution) => {
          if (institution === list.primaryInstitution) {
            institutions.push({ name: institution, tag: 'Primary'})
          } else {
            institutions.push({ name: institution })
          }
        })
        rows.push({ title: 'Institutions', values: institutions});
      }
    }

    if (list.emails) {
      if (list.emails.length > 0) {
        let formattedEmails = list.emails.map((email) => {
          return {name: email}
        })
        rows.push({ title: 'Emails', values: formattedEmails})
      }
    }

    let formattedRelationships = [];
    if (list.knownRelationships) {
      list.knownRelationships.forEach((relationship: any) => {
        let formattedName = fullName(relationship.name);
        if (relationship.type) formattedName = formattedName + ' (' + relationship.type + ')'
        formattedRelationships.push(formattedName);
      })
    }

    if (list.grants) {
      let grantsList = formatter.format(list.grants);
      rows.push({ title: 'Grants', values: [{ name: grantsList }]})
    }

    if (list.personTypes) {
      let personTypesList = formatter.format(list.personTypes);
      rows.push({ title: 'Person Types', values: [{ name: personTypesList }]})
    }

    return(
      <>
        {
          rows.map((row: any, index: number) => {
            return (
              <tr key={index}>
                <td align="right" width="20%">
                  <div className="m-3">
                    <b>{row.title}</b>
                  </div>
                </td>
                <td width="80%">
                   {row.values.map((value: TableRow, index: number) => {
                     return (
                       <p key={index}>{value.name} {value.tag && <span className={styles.highlighted}>{value.tag}</span>}</p>
                     )
                   })}
                </td>
              </tr>
            )
          })
        } 
        {
          list.knownRelationships && list.knownRelationships.length > 0 &&
          <tr key={rows.length}>
            <td align="right" width="20%">
              <div className="m-3">
                <b>Known Relationships</b>
              </div>
            </td>
            <td width="80%">
              <DisplayRelationships
                defaultNumber={relationshipsDisplayed}
                relationships={formattedRelationships}
              />
            </td>
          </tr>
        }
      </>
    )
  }

  return (
    <Modal show={modalShow} size="lg" onHide={handleClose}>
      {
        isLoading ? 
        <Modal.Body><Loader /></Modal.Body> : 
        isError ? 
        <Modal.Body><p>Something went wrong. Please try again later.</p></Modal.Body> :
        <>
        <Modal.Header closeButton className={styles.modalHeader}>
          <Container>
            <Row>
              <div className="img-container">
              {/* <Image
                loader={imageLoader}
                src={identityData.identityImageEndpoint ? identityData.identityImageEndpoint : ''}
                alt='Profile Image'
                width={144}
                height={300}
              /> */}
              </div>
              <div className="flex-grow-1">
                <DisplayName 
                  name={identity.primaryName}
                />
                <b>{identity.title}</b>
                <p>{identity.primaryOrganizationalUnit}</p>
                <div className="index-data"></div>
                  <Button variant="warning" className="m-2">Export articles as CSV</Button>
                  <Button variant="warning" className="m-2">Export articles as RTF</Button>
                  {showBiblioBtn && <Button variant="warning" onClick={() => generateBiblioAnalysis()} className="m-2">Generate bibliometric analysis</Button>}
              </div>
            </Row>
          </Container>
        </Modal.Header>
        <Modal.Body>
          <Container className="px-5">
            <p>The following are attributes from institutional data sources. This data can only be corrected in authorative systems of record.</p>
            <table id="profile-table" className={styles.profileTable}>
              <tbody>
                <TableRows
                  list={identity}
                />
              </tbody>
            </table>
          </Container>
        </Modal.Body>
        </>
      }
    </Modal>
  )
}

export default Profile;