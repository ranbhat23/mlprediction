import MLR from 'ml-regression-multivariate-linear';

/**
 * Interface defining the structure of a single data point (Open, High, Low, Close).
 */
interface IntradayData {
    open: number;
    high: number;
    low: number;
    close: number;
}

/**
 * Prepares the features (X) and labels (Y) for the Multivariate Linear Regression model.
 * * Features (X): [Open_t, Close_{t-1}, High_{t-1}, Low_{t-1}]
 * Labels (Y): [[Close_{t}]] - Note: Y must be a 2D array for the MLR library.
 * * @param data The chronological array of stock price data.
 * @returns An object containing the features array (X) and the labels array (Y).
 */
function prepareLaggedData(data: IntradayData[]): { X: number[][], Y: number[][] } {
    if (data.length < 2) {
        // Need at least one day (t-1) to predict the next day (t)
        return { X: [], Y: [] };
    }

    // Features: array of arrays [Open_t, Close_{t-1}, High_{t-1}, Low_{t-1}]
    const X: number[][] = []; 
    // Y must be number[][] (2D array) for MLR constructor
    const Y: number[][] = [];   // Labels: array of [Close_{t}]

    // Start from the second day (index 1) because the first day has no t-1 data.
    for (let i = 1; i < data.length; i++) {
        const today = data[i];
        const yesterday = data[i - 1];

        // 4 Features for prediction: (Open of TODAY) + (Close, High, Low of YESTERDAY)
        const features: number[] = [
            today.open,        // Feature 1: Current Day's Open (Open_t)
            yesterday.close,   // Feature 2: Previous Day's Close (Close_{t-1})
            yesterday.high,    // Feature 3: Previous Day's High (High_{t-1})
            yesterday.low      // Feature 4: Previous Day's Low (Low_{t-1})
        ];
        X.push(features);
       Y.push([today.close]);
    }
    return { X, Y };
}

/**
 * Runs the Multivariate Linear Regression strategy on the provided intraday data.
 * * The model uses the current day's Open price (t) and the previous day's OHLC (t-1)
 * to predict the Close price of day t.
 * * @param excelData The array of IntradayData to train the model and make a prediction.
 */
export async function simpleRunStrategy(excelData: IntradayData[]): Promise<void> {
    if (excelData.length < 3) {
        console.error("Error: Need at least 3 data points (2 for training, 1 for prediction input) to run the strategy.");
        return;
    }

    console.log(`--- Running MLR Strategy with ${excelData.length} Data Points ---`);

    // We isolate the last two data points for the final prediction check:
    // predictionTargetDay is Day N (used for its Open_N and to check its actual Close_N)
    const predictionTargetDay = excelData[excelData.length - 1]; 
    // previousDay is Day N-1 (used for its lagged features: Close_{N-1}, High_{N-1}, Low_{N-1})
    const previousDay = excelData[excelData.length - 2];       
    
    // The training set is D1 up to D(N-1).
    const trainingSet = excelData.slice(0, excelData.length - 1);
    
    // Prepare X and Y from the training set
    const { X, Y } = prepareLaggedData(trainingSet);

    if (X.length === 0) {
        console.log("Not enough data to create features and labels.");
        return;
    }
    
    console.log(`Training Model on ${X.length} samples...`);

    // 2. Create and Train the Multivariate Linear Regression model
    const regression = new MLR(X, Y);

    // 3. Log Model Parameters
    console.log('--- Model Parameters ---');
    console.log('Features Used: [Open_t, Close_{t-1}, High_{t-1}, Low_{t-1}]');
    // Note: regression.weights is a number[][] but for single output we expect [4][1]
    console.log('Coefficients (Weights):', regression.weights.map((w: number[]) => w[0].toFixed(4)));
    
    // 4. Prepare New Input for Prediction (for the last day in the set, Day N)
    const lastDayFeatures: number[] = [
        predictionTargetDay.open, // Current Day Open (Open_N)
        previousDay.close,        // Previous Day Close (Close_{N-1})
        previousDay.high,         // Previous Day High (High_{N-1})
        previousDay.low           // Previous Day Low (Low_{N-1})
    ];

    // 5. Make the Prediction
    // FIX: Use [0][0] to extract the single prediction number from the returned [[number]] array.
    const predictedClose: number = regression.predict([lastDayFeatures])[0][0];
    const actualClose: number = predictionTargetDay.close;
    
    // 6. Output Results
    console.log('\n--- Prediction Output ---');
    console.log(`Current Day Open Price: $${predictionTargetDay.open.toFixed(2)}`);
    console.log(`Input features (t Open, t-1 Close, High, Low): [${lastDayFeatures.map(f => f.toFixed(2)).join(', ')}]`);
    console.log(`Predicted Close Price (t): $${predictedClose.toFixed(2)}`);

    // 7. Performance Check on the last day's prediction
    console.log(`\n--- Performance Check (Day N) ---`);
    console.log(`Actual Close: $${actualClose.toFixed(2)}`);
    const deviation = predictedClose - actualClose;
    console.log(`Deviation: $${deviation.toFixed(2)}`);

    // Optionally, evaluate against the first training point's actual close for illustrative purposes
    const predictionCheckX = X[X.length - 1]; // Last training input (which is already a number[] array of features)
    // We access the single target value from the 2D array Y
    const predictionCheckY = Y[Y.length - 1][0]; 
    // FIX: Use [0][0] to extract the single prediction number from the returned [[number]] array.
    const predictedCheck: number = regression.predict([predictionCheckX])[0][0];
    console.log('\n--- Training Set Check (Last Training Sample) ---');
    console.log(`Input Features (t Open, t-1 Close, High, Low): [${predictionCheckX.map(f => f.toFixed(2)).join(', ')}]`);
    console.log(`Actual Close for Day ${X.length}: $${predictionCheckY.toFixed(2)}`);
    console.log(`Model Predicted Close: $${predictedCheck.toFixed(2)}`);
    console.log(`Deviation: $${(predictedCheck - predictionCheckY).toFixed(2)}`);
}

// ------------------------
// --- RUNNABLE EXAMPLE ---
// ------------------------

const sampleStockData: IntradayData[] = [
    // Day 1: Training Input t-1 (Lagged features for Day 2)
    { open: 745.9, high: 749.5, low: 731.95, close: 743.85 },
    // Day 2: Training Sample 1: Features = [745.0 (Open_2), 743.85, 749.5, 731.95]. Target = 753.80
    { open: 745.0, high: 758.8, low: 744.85, close: 753.80 },
    // Day 3: Training Sample 2: Features = [759.95 (Open_3), 753.80, 758.8, 744.85]. Target = 761.95
    { open: 759.95, high: 769.7, low: 758.05, close: 761.95 },
    // Day 4: Training Sample 3: Features = [761.9 (Open_4), 761.95, 769.7, 758.05]. Target = 765.95
    { open: 761.9, high: 769.4, low: 755.3, close: 765.95 },
    // Day 5 (N-1): Lagged features for Day 6
    { open: 766.0, high: 790.6, low: 764.1, close: 780.35 },
    // Day 6 (N - Final Prediction Target): Open_6 is used as a feature, Close_6 is the actual target
    { open: 785.0, high: 788.0, low: 775.0, close: 778.50 } 
    // The prediction is made for the Close price of Day 6, using Open_6 and OHLC_5.
];
