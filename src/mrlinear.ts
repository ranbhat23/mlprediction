import MLR from 'ml-regression-multivariate-linear';

/**
 * @interface IntradayData
 * The data structure for daily stock information, now including volume.
 */
interface IntradayData {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number; // Added Volume
}

// --- CONFIGURATION CONSTANTS ---
// Lookback period for indicators like ATR and RSI.
const LOOKBACK_PERIOD = 14; 
// Short period for simpler moving averages, more suitable for a small dataset.
const SHORT_PERIOD = 5; 

// Helper class for Min-Max Scaling (remains unchanged)
class MinMaxScaler {
    private min: number[];
    private max: number[];

    // Calculates min and max for each feature/column in the data matrix
    constructor(data: number[][]) {
        if (data.length === 0) {
            this.min = [];
            this.max = [];
            return;
        }
        const numFeatures = data[0].length;
        this.min = new Array(numFeatures).fill(Infinity);
        this.max = new Array(numFeatures).fill(-Infinity);

        for (const row of data) {
            for (let j = 0; j < numFeatures; j++) {
                this.min[j] = Math.min(this.min[j], row[j]);
                this.max[j] = Math.max(this.max[j], row[j]);
            }
        }
    }

    // Scales a single data point (row)
    scale(dataPoint: number[]): number[] {
        return dataPoint.map((value, j) => {
            const range = this.max[j] - this.min[j];
            if (range === 0) return 0.5; // Avoid division by zero, use midpoint
            return (value - this.min[j]) / range;
        });
    }

    // Scales the entire data matrix
    scaleAll(data: number[][]): number[][] {
        return data.map(row => this.scale(row));
    }

    // Inverse scales a single data point (row) back to its original value
    inverseScale(scaledDataPoint: number[]): number[] {
        return scaledDataPoint.map((scaledValue, j) => {
            const range = this.max[j] - this.min[j];
            return scaledValue * range + this.min[j];
        });
    }
}


// --- INDICATOR HELPER FUNCTIONS ---

/**
 * Calculates True Range (TR) for a given day.
 */
function calculateTrueRange(today: IntradayData, yesterdayClose: number): number {
    const highLow = today.high - today.low;
    const highPrevClose = Math.abs(today.high - yesterdayClose);
    const lowPrevClose = Math.abs(today.low - yesterdayClose);
    return Math.max(highLow, highPrevClose, lowPrevClose);
}

/**
 * Calculates Average True Range (ATR) based on a simple moving average of TR.
 */
function calculateATR(data: IntradayData[], index: number, period: number = LOOKBACK_PERIOD): number {
    if (index < period) return 0; // Not enough data for full ATR

    let sumTR = 0;
    // Calculate the sum of TR for the 'period' days ending at index-1
    for (let i = index - period; i < index; i++) {
        const yesterdayClose = (i === 0) ? data[i].close : data[i - 1].close;
        sumTR += calculateTrueRange(data[i], yesterdayClose);
    }
    return sumTR / period;
}

/**
 * Calculates Simple Moving Average (SMA) of the closing prices.
 * It calculates the SMA of the 'period' closes ending *before* the current day (index).
 */
function calculateSMA(data: IntradayData[], index: number, period: number): number {
    if (index < period) return data[index]?.close || 0; // Return current close or 0 if too early
    let sum = 0;
    // Sum closes from index - period up to index - 1
    for (let i = index - period; i < index; i++) { 
        sum += data[i].close;
    }
    return sum / period;
}

/**
 * Calculates Exponential Moving Average (EMA) of the closing prices.
 * It calculates the EMA value at the day *before* the current day (index).
 */
function calculateEMA(data: IntradayData[], index: number, period: number): number {
    if (index < period) {
        // Not enough data for full EMA, return SMA approximation
        return calculateSMA(data, index, period); 
    }
    
    const multiplier = 2 / (period + 1);
    
    // 1. Initialize EMA with SMA of the first 'period' days
    let ema = calculateSMA(data, period, period); 

    // 2. Iterate from day 'period' up to index-1 to get the t-1 EMA value
    for (let i = period; i < index; i++) {
        // EMA = (Close - Previous EMA) * Multiplier + Previous EMA
        ema = (data[i].close - ema) * multiplier + ema;
    }

    return ema;
}

/**
 * Calculates Relative Strength Index (RSI).
 */
function calculateRSI(data: IntradayData[], index: number, period: number = LOOKBACK_PERIOD): number {
    if (index < period) return 50; // Neutral value until enough data is available

    let avgGain = 0;
    let avgLoss = 0;

    // Calculate sum of gains and losses over the period ending at index
    for (let i = index - period + 1; i <= index; i++) {
        const change = data[i].close - data[i - 1].close;
        if (change > 0) {
            avgGain += change;
        } else {
            avgLoss += Math.abs(change);
        }
    }

    avgGain /= period;
    avgLoss /= period;

    if (avgLoss === 0) return 100;
    const RS = avgGain / avgLoss;
    return 100 - (100 / (1 + RS));
}


/**
 * Calculates Volume Weighted Average Price (VWAP) for the period up to the current day.
 */
function calculateVWAP(data: IntradayData[], index: number): number {
    if (index === 0) return data[0].close;
    
    let cumulativeTPV = 0; // Cumulative Typical Price * Volume
    let cumulativeVolume = 0; // Cumulative Volume

    // Calculate VWAP up to (and including) the day at 'index'
    for (let i = 0; i <= index; i++) {
        const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
        cumulativeTPV += typicalPrice * data[i].volume;
        cumulativeVolume += data[i].volume;
    }

    return (cumulativeVolume === 0) ? data[index].close : cumulativeTPV / cumulativeVolume;
}


/**
 * Prepares the 10 features (X) and labels (Y) for the regression model, 
 * using SMA and EMA instead of MACD.
 */
function prepareLaggedData(data: IntradayData[]): { X: number[][], Y: number[][] } {
    // We now need enough data for the LONGEST period (ATR/RSI = 14) to be stable.
    if (data.length <= LOOKBACK_PERIOD) {
        console.warn(`Warning: Need at least ${LOOKBACK_PERIOD + 1} data points to generate features with indicators.`);
        return { X: [], Y: [] };
    }
    
    const X: number[][] = []; 
    const Y: number[][] = [];

    // Start feature generation at index LOOKBACK_PERIOD (e.g., Day 14) 
    for (let i = LOOKBACK_PERIOD; i < data.length; i++) {
        const today = data[i];
        const yesterday = data[i - 1]; // This is the t-1 day used for indicator values

        // --- Core Price/Volume Features (t and t-1) ---
        const yesterdayPP = (yesterday.high + yesterday.low + yesterday.close) / 3;

        // --- New Indicator Features (all t-1) ---
        const atr_t_minus_1 = calculateATR(data, i, LOOKBACK_PERIOD);
        const rsi_t_minus_1 = calculateRSI(data, i - 1, LOOKBACK_PERIOD); // RSI needs index-1 as the end date

        const sma_t_minus_1 = calculateSMA(data, i, SHORT_PERIOD);
//        const ema_t_minus_1 = calculateEMA(data, i, SHORT_PERIOD);

        // 10 Features: 
        // [Open_t, Close_{t-1}, High_{t-1}, Low_{t-1}, PP_{t-1}, Volume_{t-1}, ATR_{t-1}, RSI_{t-1}, SMA_{t-1}, EMA_{t-1}]
        const features: number[] = [
            // Core 5 Price Features
            today.open,             // Feature 1: Current Day's Open (Open_t)
            yesterday.close,        // Feature 2: Previous Day's Close (Close_{t-1})
            yesterday.high,         // Feature 3: Previous Day's High (High_{t-1})
            yesterday.low,          // Feature 4: Previous Day's Low (Low_{t-1})
            yesterdayPP,            // Feature 5: Previous Day's Pivot Point (PP_{t-1})
            
            // Core Volume Feature
            yesterday.volume,       // Feature 6: Previous Day's Volume (Volume_{t-1})
            
            // 4 Indicator Features
            atr_t_minus_1,          // Feature 7: Average True Range (ATR_{t-1})
            rsi_t_minus_1,          // Feature 8: Relative Strength Index (RSI_{t-1})
            sma_t_minus_1,          // Feature 9: Short SMA (SMA_{t-1})
            
            // NOTE: Close/VWAP is removed to keep the feature count at 10 and integrate SMA/EMA
        ];
        X.push(features);

        // Label (Today's Close)
        Y.push([today.close]);
    }
    return { X, Y };
}

// Separate function to flatten Y for scaler initialization
function flattenY(Y: number[][]): number[][] {
    return Y.map(row => [row[0]]);
}

/**
 * Runs the Multivariate Linear Regression strategy on the provided intraday data with Min-Max Scaling.
 * * @param excelData The array of IntradayData to train the model and make a prediction.
 * @param newOpenPrice Optional: The open price for the prediction day (Day N). If provided, 
 * it simulates a real-time user input. If undefined, the model uses 
 * the actual open price from the last data point for simulation.
 */
export async function mrlRunStrategy(excelData: IntradayData[], newOpenPrice?: number): Promise<void> {
    if (excelData.length < LOOKBACK_PERIOD + 2) {
        console.error(`Error: Need at least ${LOOKBACK_PERIOD + 2} data points (14 for indicators, 1 for training, 1 for prediction input) to run the strategy.`);
        return;
    }
    console.log(`--- Running MLR Strategy with ${excelData.length} Data Points (10 Features) ---`);

    // The day being predicted and evaluated (index N-1 in the array).
    const dayToEvaluate = excelData[excelData.length - 1]; 
    // The previous day, providing all the t-1 features (index N-2 in the array).
    const dayProvidingLaggedFeatures = excelData[excelData.length - 2]; 

    // The training set is D1 up to D(N-1). 
    const trainingSet = excelData.slice(0, excelData.length - 1);
    
    // Prepare the training data (X_raw contains D14 up to D(N-1) features)
    const { X: X_raw, Y: Y_raw } = prepareLaggedData(trainingSet);

    if (X_raw.length === 0) {
        console.log("Not enough data to create features and labels after lookback period.");
        return;
    }
    
    // 1. Initialize and Fit Scalers
    const featureScaler = new MinMaxScaler(X_raw);
    const labelScaler = new MinMaxScaler(Y_raw.map(row => [row[0]])); 
    
    // 2. Scale the Training Data
    const X_scaled = featureScaler.scaleAll(X_raw);
    const Y_scaled = labelScaler.scaleAll(flattenY(Y_raw)); 

    console.log(`Training Model on ${X_scaled.length} scaled samples (10 Features)...`);

    // 3. Create and Train the Multivariate Linear Regression model on SCALED data
    const regression = new MLR(X_scaled, Y_scaled);

    // 4. Prepare New Input for Prediction (for the last day in the set, Day N)
    const entireHistoryUpToPreviousDay = excelData.slice(0, excelData.length - 1); 

    // --- Calculate the 9 features for Day N prediction ---
    const previousDayPP = (dayProvidingLaggedFeatures.high + dayProvidingLaggedFeatures.low + dayProvidingLaggedFeatures.close) / 3;

    // Use the entire history up to the previous day (length - 1) for indicators
    const fullHistoryLength = entireHistoryUpToPreviousDay.length;
    
    const atr_t_minus_1_pred = calculateATR(entireHistoryUpToPreviousDay, fullHistoryLength, LOOKBACK_PERIOD);
    const rsi_t_minus_1_pred = calculateRSI(entireHistoryUpToPreviousDay, fullHistoryLength - 1, LOOKBACK_PERIOD);

    const sma_t_minus_1_pred = calculateSMA(entireHistoryUpToPreviousDay, fullHistoryLength, SHORT_PERIOD);
    const ema_t_minus_1_pred = calculateEMA(entireHistoryUpToPreviousDay, fullHistoryLength, SHORT_PERIOD);

    // THIS IS THE REAL-LIFE INPUT POINT:
    const openPriceForPrediction = newOpenPrice ?? dayToEvaluate.open;

    const lastDayFeatures_raw: number[] = [
        // Core 5 Price Features
        openPriceForPrediction,         // Feature 1: Current Day's Open (Open_t) - USES user/simulated input
        dayProvidingLaggedFeatures.close, // Feature 2: Previous Day's Close (Close_{t-1})
        dayProvidingLaggedFeatures.high,  // Feature 3: Previous Day's High (High_{t-1})
        dayProvidingLaggedFeatures.low,   // Feature 4: Previous Day's Low (Low_{t-1})
        previousDayPP,            // Feature 5: Previous Day's Pivot Point (PP_{t-1})
        
        // Core Volume Feature
        dayProvidingLaggedFeatures.volume, // Feature 6: Previous Day's Volume (Volume_{t-1})
        
        // 4 Indicator Features
        atr_t_minus_1_pred,       // Feature 7: Average True Range (ATR_{t-1})
        rsi_t_minus_1_pred,       // Feature 8: Relative Strength Index (RSI_{t-1})
        sma_t_minus_1_pred,       // Feature 9: Short SMA (SMA_{t-1})
    ];

    // 5. Scale the Prediction Input
    const lastDayFeatures_scaled: number[] = featureScaler.scale(lastDayFeatures_raw);

    // 6. Make the Prediction on SCALED input
    const predictedClose_scaled: number = regression.predict([lastDayFeatures_scaled])[0][0];

    // 7. Inverse Scale the Prediction back to original units
    const predictedClose: number = labelScaler.inverseScale([predictedClose_scaled])[0];
    const actualClose: number = dayToEvaluate.close;
    
    // 8. Output Results
    console.log('--- Overall Model Performance (Training Set) ---');
    console.log('\n--- Prediction Output ---');
    console.log('Features (10): [Open, Close, High, Low, PP, Volume, ATR, RSI, SMA(5), EMA(5)] (all t-1 except Open)');
    
    // Log the price used for prediction input
    console.log(`Input (t Open PRICE USED): $${openPriceForPrediction.toFixed(2)}`);

    console.log(`Previous Day (t-1) Indicators: Volume ${dayProvidingLaggedFeatures.volume.toFixed(0)}, ATR ${atr_t_minus_1_pred.toFixed(2)}, RSI ${rsi_t_minus_1_pred.toFixed(2)}, SMA(5) ${sma_t_minus_1_pred.toFixed(2)}`);
    
    console.log(`Predicted Close Price (t): $${predictedClose.toFixed(2)}`);
    
    // We still log the actual close to measure the error of the simulation:
    console.log(`Actual Close: $${actualClose.toFixed(2)} (Used for error check only)`);
    
    const deviation = predictedClose - actualClose;
    console.log(`Deviation: $${deviation.toFixed(2)}`);
    
    const _deviation = (predictedClose - actualClose) / actualClose * 100;
    console.log(`Deviation%: ${_deviation.toFixed(2)}%`);
}
