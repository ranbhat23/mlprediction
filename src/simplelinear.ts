import MLR from 'ml-regression-multivariate-linear';

interface IntradayData {
    open: number;
    high: number;
    low: number;
    close: number;
}

// Helper class for Min-Max Scaling
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


/**
 * Prepares the features (X) and labels (Y) for the Multivariate Linear Regression model.
 * * Features (X): [Open_t, Close_{t-1}, High_{t-1}, Low_{t-1}, PP_{t-1}] (5 Features)
 * Labels (Y): [[Close_{t}]] - Note: Y must be a 2D array for the MLR library.
 * * @param data The chronological array of stock price data.
 * @returns An object containing the features array (X) and the labels array (Y).
 */
function prepareLaggedData(data: IntradayData[]): { X: number[][], Y: number[][] } {
    if (data.length < 2) {
        // Need at least one day (t-1) to predict the next day (t)
        return { X: [], Y: [] };
    }
    
    // Features: array of arrays [Open_t, Close_{t-1}, High_{t-1}, Low_{t-1}, PP_{t-1}]
    const X: number[][] = []; 
    // Y must be number[][] (2D array) for MLR constructor
    const Y: number[][] = [];// Labels: array of [Close_{t}]

    // Start from the second day (index 1) because the first day has no t-1 data.
    for (let i = 1; i < data.length; i++) {
        const today = data[i];
        const yesterday = data[i - 1];

        // Calculate Pivot Point for t-1
        const yesterdayPP = (yesterday.high + yesterday.low + yesterday.close) / 3;

        // 5 Features: (Open of TODAY) + (Close, High, Low, PP of YESTERDAY)
        const features: number[] = [
            today.open,// Feature 1: Current Day's Open (Open_t)
            yesterday.close,// Feature 2: Previous Day's Close (Close_{t-1})
            yesterday.high,// Feature 3: Previous Day's High (High_{t-1})
            yesterday.low, // Feature 4: Previous Day's Low (Low_{t-1})
            yesterdayPP// Feature 5: Previous Day's Pivot Point (PP_{t-1})
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
 */
export async function simpleRunStrategy(excelData: IntradayData[]): Promise<void> {
    if (excelData.length < 5) {
        console.error("Error: Need at least 3 data points (2 for training, 1 for prediction input) to run the strategy.");
        return;
    }

    console.log(`--- Running MLR Strategy with ${excelData.length} Data Points (with Scaling) ---`);

    // We isolate the last two data points for the final prediction check:
  //  const predictionTargetDay = excelData[excelData.length - 1]; 
  //  const previousDay = excelData[excelData.length - 2]; 
    
    const predictionTargetDay = excelData[excelData.length - 1]; 
  
    const previousDay = excelData[excelData.length - 2]; 
    // The training set is D1 up to D(N-1).
   const trainingSet = excelData.slice(0, excelData.length - 1);
 //    const trainingSet = excelData.slice(0, excelData.length - 0);
    
    const { X: X_raw, Y: Y_raw } = prepareLaggedData(trainingSet);

    if (X_raw.length === 0) {
        console.log("Not enough data to create features and labels.");
        return;
    }
    
    // 1. Initialize and Fit Scalers
    const featureScaler = new MinMaxScaler(X_raw);
    // Y has a single column, but MinMaxScaler expects an array of arrays, so we use flattenY and re-shape
    const labelScaler = new MinMaxScaler(Y_raw.map(row => [row[0]])); 
    
    // 2. Scale the Training Data
    const X_scaled = featureScaler.scaleAll(X_raw);
    const Y_scaled = labelScaler.scaleAll(flattenY(Y_raw)); // Y is 2D, scale it as such

    console.log(`Training Model on ${X_scaled.length} scaled samples (5 Features)...`);

    // 3. Create and Train the Multivariate Linear Regression model on SCALED data
    const regression = new MLR(X_scaled, Y_scaled);

    // 4. Log Model Parameters
    console.log('--- Model Parameters (Trained on Scaled Data) ---');
    console.log('Features Used: [Open_t, Close_{t-1}, High_{t-1}, Low_{t-1}, PP_{t-1}]');
    console.log('Coefficients (Weights):', regression.weights.map((w: number[]) => w[0].toFixed(4)));
    
    // 5. Prepare New Input for Prediction (for the last day in the set, Day N)
    const previousDayPP = (previousDay.high + previousDay.low + previousDay.close) / 3;

    const lastDayFeatures_raw: number[] = [
        predictionTargetDay.open, 
        previousDay.close,
        previousDay.high, 
        previousDay.low,
        previousDayPP 
    ];

    // 6. Scale the Prediction Input
    const lastDayFeatures_scaled: number[] = featureScaler.scale(lastDayFeatures_raw);

    // 7. Make the Prediction on SCALED input
    // regression.predict returns [[scaled_close]]
    const predictedClose_scaled: number = regression.predict([lastDayFeatures_scaled])[0][0];

    // 8. Inverse Scale the Prediction back to original units
    // labelScaler.inverseScale expects [[number]], but since the output is a single value, 
    // we pass [predictedClose_scaled] and take the [0] element of the result.
    const predictedClose: number = labelScaler.inverseScale([predictedClose_scaled])[0];
    const actualClose: number = predictionTargetDay.close;
    
    // 9. Output Results
    console.log('\n--- Prediction Output ---');
    console.log('*** All prices are now in original scale ***');
    console.log(`Input features (t Open, t-1 Close, High, Low, PP): [${lastDayFeatures_raw.map(f => f.toFixed(2)).join(', ')}]`);
    console.log(`Current Day Open Price: $${predictionTargetDay.open.toFixed(2)}`);
    console.log(`Predicted Close Price (t): $${predictedClose.toFixed(2)}`);
    console.log(`Actual Close: $${actualClose.toFixed(2)}`);
    const deviation = predictedClose - actualClose;
    console.log(`Deviation: $${deviation.toFixed(2)}`);
    const _deviation = (predictedClose - actualClose) / actualClose * 100;
    console.log(`Deviation%: ${_deviation.toFixed(2)}%`);
}