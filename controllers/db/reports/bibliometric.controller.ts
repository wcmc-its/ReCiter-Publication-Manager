import type { NextApiRequest, NextApiResponse } from "next";
import sequelize from "../../../src/db/db";
import models from '../../../src/db/sequelize';

export const generateBibliometricAnalysis = async (
  req: NextApiRequest,
  res: NextApiResponse,
  uid: string | string[]
) => {
  try {
    const bibliometricAnalysis: any = await sequelize.query(
      "CALL generateBibliometricReport (:uid)",
      { replacements: { uid: uid }, raw: true}
    );
    return Array.isArray(bibliometricAnalysis) && bibliometricAnalysis.length > 0?bibliometricAnalysis[0].x:"Error creating the file";
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};


export const showBibliometricAnalysisButton = async (
  req: NextApiRequest,
  res: NextApiResponse,
  uid: string | string[]
) => {
  try {
    const showbibliometricAnalysis: number = await models.AnalysisSummaryPerson.count({ where: {personIdentifier: uid}})
    return showbibliometricAnalysis && showbibliometricAnalysis > 0? true: false;
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};
