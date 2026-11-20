// Client side of the bibliometric analysis .docx (5h B3), shared by the Profile drawer button and
// the Reports dialog. The server names the file (BibliometricAnalysis-<uid>-<date>.docx).

export type BibliometricDownloadResult =
  | { ok: true; fileName: string }
  | { ok: false; status: number; message: string };

const DEFAULT_ERROR = "Unable to generate the bibliometric analysis. Please try again.";

/** Reads the filename out of `attachment; filename="..."`. */
export const fileNameFromDisposition = (header: string | null, fallback: string): string => {
  const m = /filename="?([^";]+)"?/i.exec(header || "");
  return m ? m[1] : fallback;
};

export const downloadBibliometricDocx = async (uid: string, apiKey: string): Promise<BibliometricDownloadResult> => {
  const response = await fetch(`/api/db/reports/bibliometric`, {
    credentials: "same-origin",
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ uid }),
  });
  if (!response.ok) {
    let message = DEFAULT_ERROR;
    try {
      const body = await response.json();
      if (body && body.error) message = body.error;
    } catch (e) { /* not JSON */ }
    return { ok: false, status: response.status, message };
  }
  const fallback = `BibliometricAnalysis-${uid}-${new Date().toISOString().slice(0, 10)}.docx`;
  const fileName = fileNameFromDisposition(response.headers.get("Content-Disposition"), fallback);
  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link); // Chrome honors the download filename only for an anchor in the DOM.
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(link.href), 10000);
  return { ok: true, fileName };
};
