import type { NextApiRequest, NextApiResponse } from "next";
import { reciterConfig } from "../../../../../../../config/local";
import { showBibliometricAnalysisButton } from "../../../../../../../controllers/db/reports/bibliometric.controller";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<boolean | string>
) {
  if (req.method === "GET") {
    if (
      req.headers.authorization !== undefined &&
      req.headers.authorization === reciterConfig.backendApiKey
    ) {
      const { uid } = req.query;
      try {
        const bibliometricAnalysis: boolean =
          await showBibliometricAnalysisButton(req, res, uid);
        console.log(
          "Show bibliometricAnalysis button for " +
            uid +
            ": " +
            bibliometricAnalysis
        );
        res.status(200).send(bibliometricAnalysis);
      } catch (err) {
        console.log(
          "Error with the api to show bibliometricAnalysis for " +
            uid +
            ": " +
            err
        );
        res
          .status(500)
          .send(
            "Error with the api to show bibliometricAnalysis for " +
              uid +
              ": " +
              err
          );
      }
    } else if (req.headers.authorization === undefined) {
      res.status(400).send("Authorization header is needed");
    } else {
      res.status(401).send("Authorization header is incorrect");
    }
  } else {
    // Default this to a bad request for now
    res.status(400).send("HTTP Method supported is GET");
  }
}
