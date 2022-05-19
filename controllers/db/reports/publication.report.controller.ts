import type { NextApiRequest, NextApiResponse } from "next";
import sequelize from "../../../src/db/db";
import { GeneratePubsApiBody, GeneratePubsPeopleOnlyApiBody } from "../../../types/publication.report.body";

export const generatePubsRtf = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    let apiBody: GeneratePubsApiBody = JSON.parse(req.body);
    const generatePubsRtfOutput: any = await sequelize.query(
      "CALL generatePubsRTF (:uids , :pmids)",
      {
        replacements: { uids: apiBody.personIdentifiers.join(','), pmids: apiBody.pmids.join(',') },
        raw: true,
      }
    );
    return Array.isArray(generatePubsRtfOutput) &&
      generatePubsRtfOutput.length > 0
      ? generatePubsRtfOutput[0].x
      : "Error creating the file";
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};

export const generatePubsPeopleOnlyRtf = async (
    req: NextApiRequest,
    res: NextApiResponse
  ) => {
    try {
      let apiBody: GeneratePubsPeopleOnlyApiBody = JSON.parse(req.body);
      const generatePubsPeopleOnlyRtfOutput: any = await sequelize.query(
        "CALL generatePubsPeopleOnlyRTF (:uids)",
        {
          replacements: { uids: apiBody.personIdentifiers?apiBody.personIdentifiers.join(','):'' },
          raw: true,
        }
      );
      console.log(generatePubsPeopleOnlyRtfOutput)
      return Array.isArray(generatePubsPeopleOnlyRtfOutput) &&
      generatePubsPeopleOnlyRtfOutput.length > 0
        ? generatePubsPeopleOnlyRtfOutput[0].x
        : "Error creating the file";
    } catch (e) {
      console.log(e);
      res.status(500).send(e);
    }
  };
