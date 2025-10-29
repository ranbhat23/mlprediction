import * as fs from 'fs'; // Import the File System module
interface IntradayBaseData {
    open: number;
    high: number;
    low: number;
    close: number;
}
// Your existing interface, which is the required format for the model
interface IntradayData extends IntradayBaseData {
   
}
interface IntradayvData extends IntradayBaseData {
    volume: number;
}
interface IntradayppData extends IntradayBaseData {
    pp: number;
}

// The format returned by your Google Finance method
interface OhlcArrays {
    open: number[];
    high: number[];
    low: number[];
    close: number[];
}
// The format returned by your Google Finance method
interface OhlcvArrays extends OhlcArrays {
    volume: number[];
}
// The format returned by your Google Finance method
interface OhlcppArrays extends OhlcArrays {
    pp: number[];
}

function cleanAndParsePrice(priceString: string): number {
    // Remove all commas from the string
    const cleanedString = priceString.replace(/,/g, '');
    return parseFloat(cleanedString);
}
// Define a union type for the possible additional keys
type ExtraDataKey = 'volume' | 'pp';

/**
 * A generic helper function to transform array-based OHLC data
 * into an array of object-based data points.
 * @param data The input array-based data (e.g., OhlcArrays, OhlcvArrays, etc.)
 * @param extraKeys An array of strings representing the additional keys to process.
 * @returns An array of transformed data objects.
 */
function transformBase<T extends OhlcArrays, R extends IntradayBaseData>(
    data: T,
    extraKeys: ExtraDataKey[] = []
): R[] {
    const dataLength = data.open.length;
    const transformedData: R[] = [];
    const allKeys = ['open', 'high', 'low', 'close', ...extraKeys] as (keyof T)[];

    // --- Data Integrity Check (Refactored) ---
    // Check if all necessary arrays have the same length
    for (const key of allKeys) {
        if (!Array.isArray(data[key as keyof T]) || (data[key as keyof T] as number[]).length !== dataLength) {
            throw new Error(`Data array for '${String(key)}' is missing or has inconsistent length.`);
        }
    }

    // --- Core Transformation Logic (Refactored) ---
    for (let i = 0; i < dataLength; i++) {
        const item: Record<string, number> = {};

        for (const key of allKeys) {
            const array = data[key as keyof T] as number[];
            // @ts-ignore: We know 'item' will eventually match 'R'
            item[key] = cleanAndParsePrice(array[i].toString());
        }

        transformedData.push(item as R);
    }

    return transformedData;
}
/**
 
 
export function transformOhlc(data: OhlcArrays): IntradayData[] {
    const dataLength = data.open.length;
    const transformedData: IntradayData[] = [];

    // Ensure all arrays have the same length (a basic check for data integrity)
    if (data.high.length !== dataLength || data.low.length !== dataLength || data.close.length !== dataLength) {
        throw new Error("OHLC arrays are not of equal length.");
    }

    // Iterate through the index (i) to combine the corresponding O, H, L, C values
    for (let i = 0; i < dataLength; i++) {
        transformedData.push({
            // Apply the cleaning and parsing function to each string value
            open: cleanAndParsePrice(data.open[i].toString()),
            high: cleanAndParsePrice(data.high[i].toString()),
            low: cleanAndParsePrice(data.low[i].toString()),
            close: cleanAndParsePrice(data.close[i].toString()),
        });
    }
    return transformedData;
}

export function transformOhlcv(data: OhlcvArrays): IntradayvData[] {
    const dataLength = data.open.length;
    const transformedData: IntradayvData[] = [];

    // Ensure all arrays have the same length (a basic check for data integrity)
    if (data.high.length !== dataLength || data.low.length !== dataLength || data.close.length !== dataLength || data.volume.length !== dataLength) {
        throw new Error("OHLC arrays are not of equal length.");
    }

    // Iterate through the index (i) to combine the corresponding O, H, L, C values
    for (let i = 0; i < dataLength; i++) {
        transformedData.push({
            // Apply the cleaning and parsing function to each string value
            open: cleanAndParsePrice(data.open[i].toString()),
            high: cleanAndParsePrice(data.high[i].toString()),
            low: cleanAndParsePrice(data.low[i].toString()),
            close: cleanAndParsePrice(data.close[i].toString()),
            volume: cleanAndParsePrice(data.volume[i].toString()),
        });
    }
    return transformedData;
}
export function transformOhlcpp(data: OhlcppArrays): IntradayppData[] {
    const dataLength = data.open.length;
    const transformedData: IntradayppData[] = [];

    // Ensure all arrays have the same length (a basic check for data integrity)
    if (data.high.length !== dataLength || data.low.length !== dataLength || data.close.length !== dataLength || data.pp.length !== dataLength) {
        throw new Error("OHLC arrays are not of equal length.");
    }

    // Iterate through the index (i) to combine the corresponding O, H, L, C values
    for (let i = 0; i < dataLength; i++) {
        transformedData.push({
            // Apply the cleaning and parsing function to each string value
            open: cleanAndParsePrice(data.open[i].toString()),
            high: cleanAndParsePrice(data.high[i].toString()),
            low: cleanAndParsePrice(data.low[i].toString()),
            close: cleanAndParsePrice(data.close[i].toString()),
            pp: cleanAndParsePrice(data.pp[i].toString()),
        });
    }
    return transformedData;
}
*/
/**
 * Converts column-based OHLC arrays into a row-based array of IntradayData objects.
 */
/*
export function transformOhlc(data: OhlcArrays): IntradayData[] {
    const dataLength = data.open.length;
    const transformedData: IntradayData[] = [];

    // Ensure all arrays have the same length (a basic check for data integrity)
    if (data.high.length !== dataLength || data.low.length !== dataLength || data.close.length !== dataLength) {
        throw new Error("OHLC arrays are not of equal length.");
    }

    // Iterate through the index (i) to combine the corresponding O, H, L, C values
    for (let i = 0; i < dataLength; i++) {
        transformedData.push({
            open: data.open[i],
            high: data.high[i],
            low: data.low[i],
            close: data.close[i],
        });
    }
    return transformedData;
}
*/
// --- How you would use it ---

// 1. Get data in column format
// const ohlcArrays = await this.getOhlcArrays();

// 2. Transform the data into the row format your model expects
// const trainingData: IntradayData[] = transformOhlc(ohlcArrays);

// 3. Use the transformed data to train your model
// await trainIntradayModel(trainingData);

// --- TYPE DEFINITION ---

export interface StockDataItem {
    open: number;
    high: number;
    low: number;
    close: number;
    pp: number;
    previousClose?: number;
    PPtoOpenPerc?: number;
    tradetakenPerc?: number;
    tradeAction?: 'Buy' | 'Sell' | '--';
    tradeResult?: number;
    // Index signature to allow iteration over keys
    [key: string]: number | string | undefined; // Updated signature to allow string and undefined
}
// STRATERGY SUMMERY
// BEST ONE 
// BUY if open is less than PP and (the PP to open is above 0.5%) and if open is less than previousclose and previous close is less than PP.
// SL is 1% and target is PP.
export function jsonToHtmlTable(jsonData: StockDataItem[], tableId: string = 'data-table') {
    if (!jsonData || jsonData.length === 0) {
        return `<p>No data to display.</p>`;
    }

    for (let i = 1; i < jsonData.length; i++) {
        // Set the current day's previousClose to the prior day's close
        jsonData[i].previousClose = jsonData[i - 1].close;
    }

    // --- EXISTING LOGIC FOR CALCULATIONS ---
    let total = 0;
    let tradetaken = 0;
    let totalTradeDays = 0;
    let totaltradetaken = 0;

    const initialLength = jsonData.length;

    jsonData.forEach(x => {
        const percentage = ((x.open - x.pp) / x.pp) * 100;
        x.PPtoOpenPerc = Math.round(percentage * 100) / 100;
        x.tradeResult = 0;
        // First, check if the movement is significant enough (> 0.5%)
        if (Math.abs(x.PPtoOpenPerc) > 0.4) {
            // 1. BUY Condition Check (x.open < x.previousclose < x.pp)
            // Checks if the Open is below the Previous Close, and the Previous Close is below the PP.
            if (x.previousClose !== undefined && x.open < x.previousClose && x.previousClose < x.pp) {
                x.tradeAction = 'Buy';
                x.tradeResult = (x.high > x.pp && x.low < x.pp) ? Math.abs(x.PPtoOpenPerc) : -1;
                totalTradeDays = totalTradeDays + 1;
                totaltradetaken = totaltradetaken + x.tradeResult;
            }
            // 2. SELL Condition Check (x.pp < x.previousclose < x.open)
            // Checks if the PP is below the Previous Close, and the Previous Close is below the Open.
            else if (x.previousClose !== undefined && x.pp < x.previousClose && x.previousClose < x.open) {
                x.tradeAction = 'Sell';
                x.tradeResult = (x.high > x.pp && x.low < x.pp) ? Math.abs(x.PPtoOpenPerc) : -1;
                totalTradeDays = totalTradeDays + 1;
                totaltradetaken = totaltradetaken + x.tradeResult;

            }
            // 3. Fallback (Trade taken, but pattern doesn't match Buy/Sell logic)
            else {
                x.tradeAction = '--';
            }

            // --- Existing Trade Calculation Logic ---
            tradetaken = tradetaken + 1;
            x.tradetakenPerc = Math.abs(x.PPtoOpenPerc);
            total = total + x.tradetakenPerc;

        }
        else {
            // Percentage movement is not significant enough
            x.tradetakenPerc = 0;
            x.tradeAction = '--'; // Set action to Neutral when trade is not taken
        }
    });

    let avgTradePercent = 0;
    let avgTradeResultPercent = 0;

    if (tradetaken > 0) {
        avgTradePercent = Math.round((total / tradetaken) * 100) / 100;
    }
    if (totaltradetaken > 0) {
        avgTradeResultPercent = Math.round((totaltradetaken / totalTradeDays) * 100) / 100;
    }

    const roundedTotal = Math.round(total * 100) / 100;

    const val: StockDataItem = {
        open: 0, high: 0, low: 0, close: 0, pp: 0,
        previousClose: roundedTotal, // No previous close for the summary row
        PPtoOpenPerc: avgTradePercent,
        tradetakenPerc: totalTradeDays,
        tradeAction: '--',
        tradeResult: avgTradeResultPercent
    };

    jsonData.push(val);

    // Object.keys(jsonData[0]) returns an array of string property names
    //  const headers: string[] = Object.keys(jsonData[0]);
    const headers: string[] = [
        'open',
        'high',
        'low',
        'close',
        'pp',
        'previousClose',
        'PPtoOpenPerc',
        'tradetakenPerc',
        'tradeAction',
        'tradeResult'
    ];

    let html = `<table id="${tableId}" border="1" style="border-collapse: collapse; width: 100%;">`;

    // Header
    html += '<thead style="background-color: #f4f4f4;"><tr>';
    headers.forEach(header => {
        // Capitalize the first letter for display
        const displayHeader = header.charAt(0).toUpperCase() + header.slice(1);
        html += `<th style="padding: 12px; border: 1px solid #ccc; text-align: left;">${displayHeader}</th>`;
    });
    html += '</tr></thead>';

    // Body
    html += '<tbody>';
    jsonData.forEach(item => {
        html += '<tr>';
        headers.forEach(header => {
            html += `<td style="padding: 12px; border: 1px solid #ccc;">${item[header]}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';

    const tableHTML: string = html;

    const fullHTML: string = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stock Data Table</title>
    <style>
        body { font-family: 'Inter', sans-serif; padding: 40px; background-color: #fafafa; }
        h1 { color: #333; margin-bottom: 20px; }
        table { border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
    </style>
</head>
<body>
    <h1>Historical Stock Prices</h1>
    ${tableHTML}
</body>
</html>
`;

    const filename: string = 'stock_data.html';

    try {
        fs.writeFileSync(filename, fullHTML, 'utf8');
        console.log(`Successfully wrote HTML table to ${filename}`);
    } catch (error) {
        console.error(`Error writing file ${filename}:`, error);
    }
}
