// Your existing interface, which is the required format for the model
interface IntradayData {
    open: number;
    high: number;
    low: number;
    close: number;
}
interface IntradayvData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

// The format returned by your Google Finance method
interface OhlcArrays {
    open: number[];
    high: number[];
    low: number[];
    close: number[];
}
// The format returned by your Google Finance method
interface OhlcvArrays {
    open: number[];
    high: number[];
    low: number[];
    close: number[];
    volume: number[];
}

function cleanAndParsePrice(priceString: string): number {
    // Remove all commas from the string
    const cleanedString = priceString.replace(/,/g, '');
    return parseFloat(cleanedString);
}

/**
 * Transforms data from separate OHLC string arrays (which may contain commas)
 * into a single chronological array of IntradayData objects (all numbers).
 * @param data An object containing separate arrays for Open, High, Low, and Close prices (as strings).
 * @returns A single array of IntradayData objects.
 */
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
