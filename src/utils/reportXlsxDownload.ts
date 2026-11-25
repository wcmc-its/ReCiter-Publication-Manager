// Client side of the 5f Excel export: POST the current report filters to the streaming .xlsx route
// and save the response. Returns null on success, else a message fit to show in the export modal.
export const downloadReportXlsx = async (
  body: { filters?: unknown; sort?: unknown },
  apiKey: string
): Promise<string | null> => {
  let response: Response;
  try {
    response = await fetch(`/api/db/reports/publication/xlsx`, {
      credentials: "same-origin",
      method: "POST",
      headers: {
        Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json",
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ filters: body.filters, sort: body.sort }),
    });
  } catch {
    return "Unable to reach the server. Please try again.";
  }
  if (!response.ok) {
    let message = "";
    try {
      const data = await response.json();
      message = data && data.error ? String(data.error) : "";
    } catch {
      // not JSON
    }
    if (response.status === 400 && message) return message;
    return message || `Unable to generate the Excel file (HTTP ${response.status}). Please try again.`;
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const fileName = match ? match[1] : `PublicationReport-ReCiter-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link); // Chrome honors the filename only for an anchor in the DOM
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(link.href), 10000);
  return null;
};
