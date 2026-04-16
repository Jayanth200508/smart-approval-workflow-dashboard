const toCsv = (rows) => {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const header = keys.join(",");
  const body = rows
    .map((row) =>
      keys
        .map((key) => {
          const value = `${row[key] ?? ""}`.replace(/"/g, '""');
          return `"${value}"`;
        })
        .join(","),
    )
    .join("\n");
  return `${header}\n${body}`;
};

const downloadFile = (filename, content, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

const ExportActions = ({ rows, fileName = "flowpilot-report" }) => {
  const exportCsv = () =>
    downloadFile(`${fileName}.csv`, toCsv(rows), "text/csv;charset=utf-8;");
  const exportPdf = () => window.print();
  const printView = () => window.print();

  return (
    <div className="export-actions">
      <button type="button" className="btn btn-outline" onClick={exportCsv}>
        Export CSV
      </button>
      <button type="button" className="btn btn-outline" onClick={exportPdf}>
        Export PDF
      </button>
      <button type="button" className="btn btn-outline" onClick={printView}>
        Print View
      </button>
    </div>
  );
};

export default ExportActions;
