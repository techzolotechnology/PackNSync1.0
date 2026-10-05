/** Escape one CSV cell (RFC 4180) and neutralise spreadsheet formula injection. */
function cell(value) {
    if (value === null || value === undefined) return '';
    let text = String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Download rows as a CSV file.
 * columns: [{ label, value: (row) => any }]
 */
export function downloadCsv(filename, rows, columns) {
    const lines = [
        columns.map((c) => cell(c.label)).join(','),
        ...rows.map((row) => columns.map((c) => cell(c.value(row))).join(',')),
    ];
    // BOM so Excel opens ₹ and other UTF-8 text correctly
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
