// Function to fetch and read the TSV file content
export async function fetchTSV(path) {
    const response = await fetch(path);
    const tsv = await response.text();
    return tsv;
}

// Function to parse TSV content
export function parseTSV(tsv) {
    // Split the TSV content by new lines to get rows
    const rows = tsv.trim().split('\n');

    // Split the first row by tab to get column headers
    const headers = rows[0].split('\t');

    // Initialize the DataFrame-like object
    const dataFrame = {};

    // Initialize each column as an empty array
    headers.forEach(header => {
        dataFrame[header] = [];
    });

    // Loop through each row (skipping the header row)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i].split('\t');
        headers.forEach((header, index) => {
            dataFrame[header].push(row[index]);
        });
    }

    return dataFrame;
}


// Function to calculate minimum and maximum for a column
export function min(df, column) {
    const values = df[column].map(value => parseFloat(value));
    const minValue = Math.min(...values);
    return minValue ;
}

export function max(df, column) {
    const values = df[column].map(value => parseFloat(value));
    const maxValue = Math.max(...values);
    return maxValue ;
}