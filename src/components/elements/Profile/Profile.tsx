import React, { useEffect, useState } from "react";
import { useDispatch, useSelector, RootStateOrAny } from "react-redux";
import { identityFetchData } from "../../../redux/actions/actions";
import { Modal, Container, Row, Button, Col } from "react-bootstrap";
import Image from 'next/image'
import Loader from "../Common/Loader";
import fullName from "../../../utils/fullName";
import styles from "./Profile.module.css";

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
   handleShow: () => void,
   handleClose: () => void,
 }) => {
  const dispatch = useDispatch()
  const identityData = useSelector((state: RootStateOrAny) => state.identityData)
  const identityFetching = useSelector((state: RootStateOrAny) => state.identityFetching)
  const relationshipsDisplayed = 10;

  useEffect(() => {
    if (modalShow && !identityData) {
      dispatch(identityFetchData(uid));
    }
  }, [modalShow])

  if (identityFetching) {
    return (
      <Modal>
        <Loader />
      </Modal>
    )
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
        list.institutions.forEach((institution) => {
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
      rows.push({ title: 'Grants', values: list.grants.map((grant) => {return {name: grant}})})
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
        !identityFetching && 
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
                  name={identityData.primaryName}
                />
                <b>{identityData.title}</b>
                <p>{identityData.primaryOrganizationalUnit}</p>
                <div className="index-data"></div>
                  <Button variant="warning" className="m-2">Export articles as CSV</Button>
                  <Button variant="warning" className="m-2">Export articles as RTF</Button>
                  <Button variant="warning" className="m-2">Generate bibliometric analysis</Button>
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
                  list={identityData}
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